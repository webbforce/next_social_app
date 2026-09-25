import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// Takes down copies that still name or picture this person, then drops the rows
// that are theirs. Photo files and the phone identity wait for the 30-day purge.
export async function eraseDeletedAccount(userId: string) {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile?.deleted_at) return;

  await retractEpisodes(admin, userId);

  const updates = await admin.from("plan_updates").delete().eq("author_id", userId);
  if (updates.error) console.error("erase updates:", updates.error.message);

  const events = await admin.from("analytics_events").delete().eq("user_id", userId);
  if (events.error) console.error("erase analytics:", events.error.message);

  const filed = await admin.from("reports").delete().eq("reporter_id", userId);
  if (filed.error) console.error("erase reports:", filed.error.message);

  const about = await admin
    .from("reports")
    .update({ reason: "Account deleted." })
    .eq("target_type", "profile")
    .eq("target_id", userId)
    .neq("reason", "Account deleted.");
  if (about.error) console.error("redact reports:", about.error.message);
}

async function retractEpisodes(admin: SupabaseClient, userId: string) {
  const [hosted, joined, uploaded] = await Promise.all([
    admin.from("plans").select("id").eq("host_id", userId),
    admin.from("plan_participants").select("plan_id").eq("user_id", userId),
    admin.from("moments").select("plan_id").eq("uploader_id", userId),
  ]);
  if (hosted.error) console.error("retract hosted:", hosted.error.message);
  if (joined.error) console.error("retract joined:", joined.error.message);
  if (uploaded.error) console.error("retract uploads:", uploaded.error.message);

  const planIds = new Set<string>();
  for (const row of hosted.data ?? []) planIds.add(row.id);
  for (const row of joined.data ?? []) planIds.add(row.plan_id);
  for (const row of uploaded.data ?? []) planIds.add(row.plan_id);

  for (const planId of planIds) {
    const { data: episode, error: episodeError } = await admin
      .from("episodes")
      .select("id, card_path, video_path")
      .eq("plan_id", planId)
      .maybeSingle();
    if (episodeError) {
      console.error("retract episode:", episodeError.message);
      continue;
    }

    const { data: files, error: listError } = await admin.storage.from("episodes").list(planId);
    if (listError) console.error("retract list:", listError.message);

    const paths = [
      ...(files ?? []).map((file) => `${planId}/${file.name}`),
      episode?.card_path,
      episode?.video_path,
    ].filter((path): path is string => !!path && !path.endsWith("/"));
    const unique = [...new Set(paths)];
    if (unique.length) {
      const { error: removeError } = await admin.storage.from("episodes").remove(unique);
      if (removeError) console.error("retract files:", removeError.message);
    }

    if (!episode) continue;
    const { error: clearError } = await admin
      .from("episodes")
      .update({
        status: "pending",
        public_share_slug: null,
        card_path: null,
        video_path: null,
        highlights: {},
        error: null,
        ready_at: null,
      })
      .eq("id", episode.id);
    if (clearError) console.error("retract clear:", clearError.message);
  }
}
