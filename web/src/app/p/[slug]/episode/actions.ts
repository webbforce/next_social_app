"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { renderEpisodeForPlan } from "@/lib/episode-render";
import { getPlanBySlug } from "@/lib/plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isTrackId, type TrackId } from "@/lib/tracks";

type Result = { error: string | null };

export async function makeEpisode(slug: string): Promise<Result> {
  const user = await getCurrentUser();
  const plan = await getPlanBySlug(slug);
  if (!user || !plan) return { error: "Plan not found." };
  if (!plan.is_host) return { error: "Only the host can make the episode." };

  const result = await renderEpisodeForPlan(slug, { actorUserId: user.id, replaceReady: true });
  if (result.error) return result;

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

export async function setEpisodeTrack(slug: string, episodeId: string, trackId: TrackId): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  if (!isTrackId(trackId)) return { error: "That music isn't available." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_episode_track", { p_episode_id: episodeId, p_track: trackId });
  if (error) return { error: "Couldn't change the music. Try again." };

  track("episode_track_changed", user.id, { slug, episode_id: episodeId, music_track: trackId });
  revalidatePath(`/p/${slug}/episode`);
  return { error: null };
}

export async function recordStartOwnPlan(surface: "episode" | "public_episode") {
  const user = await getCurrentUser();
  track("start_own_plan_tapped", user?.id ?? null, { surface });
}

function reelExt(mime: string) {
  return mime.includes("webm") ? "webm" : "mp4";
}

export async function createReelUpload(
  slug: string,
  episodeId: string,
  mime: string,
): Promise<{ error: string | null; path?: string; token?: string }> {
  const user = await getCurrentUser();
  const plan = await getPlanBySlug(slug);
  if (!user || !plan) return { error: "Plan not found." };
  const insider = plan.is_host || plan.my_rsvp === "in" || plan.my_rsvp === "maybe";
  if (!insider) return { error: "Only people on the plan can save the reel." };
  if (!mime.startsWith("video/")) return { error: "That isn't a video." };

  const admin = createAdminClient();
  const { data: episode } = await admin.from("episodes").select("id, plan_id").eq("id", episodeId).maybeSingle();
  if (!episode || episode.plan_id !== plan.id) return { error: "Episode not found." };

  const path = `${plan.id}/reel.${reelExt(mime)}`;
  const { data, error } = await admin.storage.from("episodes").createSignedUploadUrl(path, { upsert: true });
  if (error || !data) return { error: "Couldn't prepare the reel upload." };
  return { error: null, path: data.path, token: data.token };
}

export async function finishReelUpload(
  slug: string,
  episodeId: string,
  path: string,
): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  const plan = await getPlanBySlug(slug);
  if (!user || !plan) return { error: "Plan not found." };
  const insider = plan.is_host || plan.my_rsvp === "in" || plan.my_rsvp === "maybe";
  if (!insider) return { error: "Only people on the plan can save the reel." };
  if (!path.startsWith(`${plan.id}/reel.`)) return { error: "Bad reel path." };

  const admin = createAdminClient();
  const { error } = await admin.from("episodes").update({ video_path: path }).eq("id", episodeId).eq("plan_id", plan.id);
  if (error) return { error: "Couldn't keep the reel for next time." };
  revalidatePath(`/p/${slug}/episode`);
  return { error: null };
}
