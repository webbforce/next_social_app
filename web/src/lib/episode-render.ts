import "server-only";
import { track } from "@/lib/analytics";
import { buildReelClips, computeHighlights, pickFormat, pickTemplate, type EpisodePhoto } from "@/lib/episode";
import { defaultTrack, isTrackId } from "@/lib/tracks";
import { renderEpisodeCard } from "@/lib/episode-card";
import { PHOTO_WINDOW_HOURS } from "@/lib/moments";
import type { PlanView } from "@/lib/plan";
import { createAdminClient } from "@/lib/supabase/admin";

export function isAutoEpisodeDue(endsAt: string, status: string, now = Date.now()) {
  if (status !== "ended") return false;
  return now >= Date.parse(endsAt) + PHOTO_WINDOW_HOURS * 3_600_000;
}

function nameFor(plan: PlanView, userId: string) {
  if (userId === plan.host.id) return plan.host.first_name;
  return plan.participants.find((p) => p.user_id === userId)?.first_name ?? "Someone";
}

async function loadUsablePhotos(plan: PlanView): Promise<EpisodePhoto[]> {
  const admin = createAdminClient();
  const { data: moments } = await admin
    .from("moments")
    .select("id, uploader_id, storage_path, taken_at, created_at")
    .eq("plan_id", plan.id)
    .is("removed_at", null)
    .order("created_at");
  if (!moments?.length) return [];

  const { data: excluded } = await admin
    .from("moment_exclusions")
    .select("moment_id")
    .in(
      "moment_id",
      moments.map((m) => m.id),
    );

  const skip = new Set((excluded ?? []).map((e) => e.moment_id));
  const usable = moments.filter((m) => !skip.has(m.id));
  if (!usable.length) return [];

  const { data: signed } = await admin.storage
    .from("moments")
    .createSignedUrls(
      usable.map((m) => m.storage_path),
      600,
    );
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return usable
    .map((m) => ({
      id: m.id,
      url: urls.get(m.storage_path) ?? "",
      takenAt: m.taken_at ?? m.created_at,
      uploaderName: nameFor(plan, m.uploader_id),
    }))
    .filter((p) => p.url);
}

export async function renderEpisodeForPlan(
  slug: string,
  opts: { actorUserId: string | null; replaceReady: boolean },
): Promise<{ error: string | null; photosUsed?: number }> {
  const admin = createAdminClient();
  const { data, error: planError } = await admin.rpc("get_plan_by_slug", { p_slug: slug });
  if (planError) return { error: "Plan not found." };
  const plan = data as PlanView | null;
  if (!plan) return { error: "Plan not found." };
  if (plan.status === "cancelled") return { error: "This plan was cancelled." };

  const { data: existing } = await admin
    .from("episodes")
    .select("id, status, ready_at, music_track")
    .eq("plan_id", plan.id)
    .maybeSingle();

  if (existing?.status === "ready" && !opts.replaceReady) return { error: null, photosUsed: 0 };
  if (existing?.status === "rendering" && !opts.replaceReady) return { error: null, photosUsed: 0 };

  const photos = await loadUsablePhotos(plan);
  if (!photos.length) return { error: "Add at least one photo first." };

  const format = pickFormat(photos.length);
  const highlights = computeHighlights(
    photos,
    plan.in_count,
    new Date(plan.starts_at),
    new Date(plan.ends_at),
    plan.place_text,
  );
  if (format === "reel") highlights.clips = buildReelClips(photos);
  const template = pickTemplate(plan.activity_tag);
  const started = Date.now();

  const { error: upsertError } = await admin.from("episodes").upsert(
    {
      ...(existing?.id ? { id: existing.id } : {}),
      plan_id: plan.id,
      format,
      template,
      music_track: isTrackId(existing?.music_track) ? existing.music_track : defaultTrack(template),
      status: "rendering",
      highlights,
      error: null,
    },
    { onConflict: "plan_id" },
  );
  if (upsertError) return { error: "Couldn't start the episode. Try again." };

  let png: Buffer;
  try {
    png = await renderEpisodeCard({
      activity: plan.activity,
      hostName: plan.host.first_name,
      template,
      highlights,
      photos,
    });
  } catch (err) {
    console.error("episode card with photos failed", err);
    try {
      png = await renderEpisodeCard({
        activity: plan.activity,
        hostName: plan.host.first_name,
        template,
        highlights,
        photos: [],
      });
    } catch (fallbackErr) {
      await admin.from("episodes").update({ status: "failed", error: "render_failed" }).eq("plan_id", plan.id);
      console.error("episode card fallback failed", fallbackErr);
      return { error: "Couldn't render the episode. Try again." };
    }
  }

  const cardPath = `${plan.id}/card.png`;
  const { error: uploadError } = await admin.storage.from("episodes").upload(cardPath, png, {
    contentType: "image/png",
    upsert: true,
  });
  if (uploadError) {
    await admin.from("episodes").update({ status: "failed", error: uploadError.message }).eq("plan_id", plan.id);
    return { error: "Couldn't save the episode image. Try again." };
  }

  const { error: readyError } = await admin
    .from("episodes")
    .update({
      status: "ready",
      card_path: cardPath,
      video_path: null,
      ready_at: new Date().toISOString(),
      error: null,
    })
    .eq("plan_id", plan.id);
  if (readyError) return { error: "Couldn't finish the episode. Try again." };

  track("episode_ready", opts.actorUserId, {
    plan_id: plan.id,
    format,
    template,
    photos_used: photos.length,
    render_ms: Date.now() - started,
    auto: !opts.replaceReady,
  });

  return { error: null, photosUsed: photos.length };
}

export async function generateDueEpisodes() {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - PHOTO_WINDOW_HOURS * 3_600_000).toISOString();
  const { data: plans } = await admin
    .from("plans")
    .select("id, share_slug, ends_at")
    .is("cancelled_at", null)
    .lte("ends_at", cutoff)
    .order("ends_at", { ascending: false })
    .limit(20);

  const due = plans ?? [];
  if (!due.length) return { considered: 0, generated: 0 };

  const ids = due.map((p) => p.id);
  const [{ data: episodes }, { data: moments }] = await Promise.all([
    admin.from("episodes").select("plan_id, status").in("plan_id", ids),
    admin.from("moments").select("plan_id").in("plan_id", ids).is("removed_at", null),
  ]);

  const ready = new Set((episodes ?? []).filter((e) => e.status === "ready").map((e) => e.plan_id));
  const rendering = new Set((episodes ?? []).filter((e) => e.status === "rendering").map((e) => e.plan_id));
  const withPhotos = new Set((moments ?? []).map((m) => m.plan_id));

  let generated = 0;
  for (const plan of due) {
    if (ready.has(plan.id) || rendering.has(plan.id) || !withPhotos.has(plan.id)) continue;
    const result = await renderEpisodeForPlan(plan.share_slug, { actorUserId: null, replaceReady: false });
    if (!result.error && (result.photosUsed ?? 0) > 0) generated += 1;
  }

  return { considered: due.length, generated };
}