export const PHOTO_WINDOW_HOURS = 12;
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_PHOTOS_PER_PICK = 20;

export const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type MomentView = {
  id: string;
  uploaderId: string;
  uploaderName: string;
  storagePath: string;
  url: string;
  createdAt: string;
};

export function isPhotoWindowOpen(startsAt: string, endsAt: string, status: string) {
  if (status === "cancelled") return false;
  const now = Date.now();
  return now >= Date.parse(startsAt) && now <= Date.parse(endsAt) + PHOTO_WINDOW_HOURS * 3_600_000;
}

export function photoExtension(file: File) {
  const fromType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  if (fromType[file.type]) return fromType[file.type];
  const name = file.name.split(".").pop()?.toLowerCase();
  return name && /^[a-z0-9]{2,5}$/.test(name) ? name : "jpg";
}

export function validatePhoto(file: File) {
  if (!ALLOWED_PHOTO_TYPES.has(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    return "That file isn't a photo we can use. Try a JPEG, PNG or HEIC.";
  }
  if (file.size > MAX_PHOTO_BYTES) return "Each photo has to be under 20 MB.";
  return null;
}
