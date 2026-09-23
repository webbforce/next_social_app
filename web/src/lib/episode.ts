import { formatDuration, formatTime } from "@/lib/time";

export type EpisodeTemplate = "bold" | "minimal";

export type EpisodeHighlights = {
  people: number;
  photos: number;
  duration: string;
  place: string | null;
  lastPhoto: string | null;
  busiest: string | null;
  topShooter: string | null;
};

export type EpisodePhoto = {
  id: string;
  url: string;
  takenAt: string;
  uploaderName: string;
};

export function pickTemplate(activityTag: string | null): EpisodeTemplate {
  return activityTag === "drinks" || activityTag === "party" ? "bold" : "minimal";
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
