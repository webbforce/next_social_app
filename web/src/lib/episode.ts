import { formatDuration, formatTime } from "@/lib/time";

export type EpisodeTemplate = "bold" | "filmstrip" | "polaroid" | "minimal";

export const REEL_PHOTO_MIN = 6;

export type ReelClip = { id: string; ms: number };

export type EpisodeHighlights = {
  people: number;
  photos: number;
  duration: string;
  place: string | null;
  lastPhoto: string | null;
  busiest: string | null;
  topShooter: string | null;
  clips?: ReelClip[];
};

export function pickFormat(photoCount: number): "card" | "reel" {
  return photoCount >= REEL_PHOTO_MIN ? "reel" : "card";
}

// 10–18 s of photos. Tight bursts cut faster; lone shots linger. End card is added in the player.
export function buildReelClips(photos: { id: string; takenAt: string }[]): ReelClip[] {
  if (photos.length < REEL_PHOTO_MIN) return [];
  const sorted = [...photos].sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
  const burstGap = 10 * 60_000;
  const groups: (typeof sorted)[] = [];
  let group = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = Date.parse(sorted[i].takenAt) - Date.parse(sorted[i - 1].takenAt);
    if (gap <= burstGap) group.push(sorted[i]);
    else {
      groups.push(group);
      group = [sorted[i]];
    }
  }
  groups.push(group);

  const groupOf = new Map<string, number>();
  for (const g of groups) for (const p of g) groupOf.set(p.id, g.length);

  const weights = sorted.map((p) => {
    const size = groupOf.get(p.id) ?? 1;
    if (size >= 3) return 0.65;
    if (size === 2) return 0.9;
    return 1.6;
  });
  const raw = weights.reduce((sum, w) => sum + w, 0);
  const target = Math.min(18_000, Math.max(10_000, photos.length * 1_100));
  return sorted.map((p, i) => ({
    id: p.id,
    ms: Math.max(400, Math.round((weights[i] / raw) * target)),
  }));
}

export type EpisodePhoto = {
  id: string;
  url: string;
  takenAt: string;
  uploaderName: string;
};

export function pickTemplate(activityTag: string | null): EpisodeTemplate {
  if (activityTag === "party") return "bold";
  if (activityTag === "drinks") return "filmstrip";
  if (activityTag === "coffee" || activityTag === "walk") return "polaroid";
  return "minimal";
}

export function statsLine(h: EpisodeHighlights) {
  const parts = [
    `${h.people} ${h.people === 1 ? "person" : "people"}`,
    `${h.photos} ${h.photos === 1 ? "photo" : "photos"}`,
    h.duration,
  ];
  if (h.place) parts.push(h.place);
  return parts.join(" · ");
}

export function computeHighlights(
  photos: { takenAt: string; uploaderName: string }[],
  people: number,
  startsAt: Date,
  endsAt: Date,
  place: string | null,
): EpisodeHighlights {
  const times = photos.map((p) => Date.parse(p.takenAt)).filter((t) => !Number.isNaN(t));
  const last = times.length ? new Date(Math.max(...times)) : null;

  const buckets = new Map<number, number>();
  for (const t of times) {
    const bucket = Math.floor(t / 600_000) * 600_000;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  let busiestAt: number | null = null;
  let busiestCount = 1;
  for (const [bucket, count] of buckets) {
    if (count > busiestCount) {
      busiestCount = count;
      busiestAt = bucket;
    }
  }

  const byName = new Map<string, number>();
  for (const p of photos) {
    byName.set(p.uploaderName, (byName.get(p.uploaderName) ?? 0) + 1);
  }
  let topName: string | null = null;
  let topCount = 1;
  for (const [name, count] of byName) {
    if (count > topCount) {
      topCount = count;
      topName = name;
    }
  }

  return {
    people,
    photos: photos.length,
    duration: formatDuration(startsAt, endsAt),
    place,
    lastPhoto: last ? `last photo ${formatTime(last)}` : null,
    busiest: busiestAt ? `busiest 10 minutes: ${formatTime(new Date(busiestAt))}` : null,
    topShooter: topName ? `${topName} took ${topCount} photos` : null,
  };
}
