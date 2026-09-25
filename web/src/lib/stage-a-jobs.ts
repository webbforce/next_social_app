import "server-only";
import { eraseDeletedAccount } from "@/lib/erasure";
import { createAdminClient } from "@/lib/supabase/admin";

const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

async function purgeDeletedAccounts() {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - PURGE_AFTER_MS).toISOString();
  const { data: due, error } = await admin
    .from("profiles")
    .select("id, photo_path")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)
    .neq("first_name", "Deleted")
    .limit(20);
  if (error) {
    console.error("purge list:", error.message);
    return 0;
  }

  let purged = 0;
  for (const profile of due ?? []) {
    try {
      await eraseDeletedAccount(profile.id);
    } catch (err) {
      console.error("erase account:", err);
      continue;
    }

    const { data: moments } = await admin.from("moments").select("storage_path").eq("uploader_id", profile.id);
    const momentPaths = (moments ?? []).map((row) => row.storage_path).filter((path): path is string => !!path);
    if (momentPaths.length) {
      const { error: removeError } = await admin.storage.from("moments").remove(momentPaths);
      if (removeError) {
        console.error("purge moments:", removeError.message);
        continue;
      }
    }

    const { data: avatarFiles } = await admin.storage.from("avatars").list(profile.id);
    const avatarPaths = [
      ...(profile.photo_path ? [profile.photo_path] : []),
      ...(avatarFiles ?? []).map((file) => `${profile.id}/${file.name}`),
    ];
    const uniqueAvatars = [...new Set(avatarPaths)];
    if (uniqueAvatars.length) {
      const { error: avatarError } = await admin.storage.from("avatars").remove(uniqueAvatars);
      if (avatarError) {
        console.error("purge avatar:", avatarError.message);
        continue;
      }
    }

    const { error: finalizeError } = await admin.rpc("finalize_account_purge", { p_user_id: profile.id });
    if (finalizeError) {
      console.error("finalize purge:", finalizeError.message);
      continue;
    }
    purged += 1;
  }

  return purged;
}

export async function runStageAMaintenance() {
  const admin = createAdminClient();
  const { data: ended, error } = await admin.rpc("record_ended_plans");
  if (error) console.error("plan_ended:", error.message);
  const purged = await purgeDeletedAccounts();
  return { ended: typeof ended === "number" ? ended : 0, purged };
}
