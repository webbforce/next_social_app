"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { computeHighlights, pickTemplate, type EpisodePhoto } from "@/lib/episode";
import { renderEpisodeCard } from "@/lib/episode-card";
import { getPlanBySlug } from "@/lib/plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result = { error: string | null };

function nameFor(plan: NonNullable<Awaited<ReturnType<typeof getPlanBySlug>>>, userId: string) {
  if (userId === plan.host.id) return plan.host.first_name;
  return plan.participants.find((p) => p.user_id === userId)?.first_name ?? "Someone";
}

async function loadUsablePhotos(plan: NonNullable<Awaited<ReturnType<typeof getPlanBySlug>>>) {
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
    .filter((p) => p.url) satisfies EpisodePhoto[];
}

export async function makeEpisode(slug: string): Promise<Result> {
  const user = await getCurrentUser();
  const plan = await getPlanBySlug(slug);
  if (!user || !plan) return { error: "Plan not found." };
  if (!plan.is_host) return { error: "Only the host can make the episode." };
  if (plan.status === "cancelled") return { error: "This plan was cancelled." };

  const photos = await loadUsablePhotos(plan);
  if (!photos.length) return { error: "Add at least one photo first." };

  const highlights = computeHighlights(
    photos,
    plan.in_count,
    new Date(plan.starts_at),
    new Date(plan.ends_at),
    plan.place_text,
  );
  const template = pickTemplate(plan.activity_tag);
  const admin = createAdminClient();
  const started = Date.now();

  const { data: existing } = await admin.from("episodes").select("id").eq("plan_id", plan.id).maybeSingle();
  const { error: upsertError } = await admin.from("episodes").upsert(
    {
      ...(existing?.id ? { id: existing.id } : {}),
      plan_id: plan.id,
      format: "card",
      template,
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
      await admin
        .from("episodes")
        .update({ status: "failed", error: "render_failed" })
        .eq("plan_id", plan.id);
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
    .update({ status: "ready", card_path: cardPath, ready_at: new Date().toISOString(), error: null })
    .eq("plan_id", plan.id);
  if (readyError) return { error: "Couldn't finish the episode. Try again." };

  track("episode_ready", user.id, {
    plan_id: plan.id,
    format: "card",
    template,
    photos_used: photos.length,
    render_ms: Date.now() - started,
  });

  revalidatePath(`/p/${slug}`);
  revalidatePath(`/p/${slug}/episode`);
  redirect(`/p/${slug}/episode`);
}

export async function toggleExclusion(slug: string, momentId: string, excluded: boolean): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const supabase = await createClient();
  const { error } = excluded
    ? await supabase.from("moment_exclusions").insert({ moment_id: momentId, user_id: user.id })
    : await supabase.from("moment_exclusions").delete().eq("moment_id", momentId).eq("user_id", user.id);

  if (error) return { error: "Couldn't update that photo. Try again." };
  track("photo_excluded", user.id, { slug, moment_id: momentId, excluded });
  revalidatePath(`/p/${slug}/episode`);
  return { error: null };
}

export async function createPublicEpisodeLink(episodeId: string, slug: string): Promise<Result & { publicSlug?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_public_episode_link", { p_episode_id: episodeId });
  if (error || !data) return { error: "Couldn't create a public link. Try again." };

  track("episode_shared", user.id, { episode_id: episodeId, destination: "public_link" });
  revalidatePath(`/p/${slug}/episode`);
  return { error: null, publicSlug: data as string };
}

export async function recordEpisodeViewed(episodeId: string, isParticipant: boolean) {
  const user = await getCurrentUser();
  track("episode_viewed", user?.id ?? null, {
    episode_id: episodeId,
    is_participant: isParticipant,
    viewer_type: user ? (user.isAnonymous ? "guest" : "host") : "signed_out",
  });
}

export async function recordEpisodeShared(episodeId: string, destination: "native" | "download") {
  const user = await getCurrentUser();
  track("episode_shared", user?.id ?? null, { episode_id: episodeId, destination });
}

export async function recordStartOwnPlan(surface: "episode" | "public_episode") {
  const user = await getCurrentUser();
  track("start_own_plan_tapped", user?.id ?? null, { surface });
}
