export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function avatarExtension(file: File) {
  if (TYPES[file.type]) return TYPES[file.type];
  const name = file.name.split(".").pop()?.toLowerCase();
  return name === "jpeg" || name === "jpg" || name === "png" || name === "webp" ? name.replace("jpeg", "jpg") : "jpg";
}

export function validateAvatar(file: File) {
  if (!TYPES[file.type] && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return "Use a JPEG, PNG or WebP photo.";
  }
  if (file.size > MAX_AVATAR_BYTES) return "Keep the photo under 5 MB.";
  return null;
}

export function avatarPath(userId: string, file: File) {
  return `${userId}/avatar.${avatarExtension(file)}`;
}
