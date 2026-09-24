import { avatarPath, validateAvatar } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/client";

export async function uploadAvatarFile(userId: string, file: File) {
  const problem = validateAvatar(file);
  if (problem) throw new Error(problem);
  const path = avatarPath(userId, file);
  const supabase = createClient();
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error("Couldn't save that photo. Try another one.");
  return path;
}
