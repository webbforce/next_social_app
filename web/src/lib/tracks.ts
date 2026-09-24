export const TRACKS = [
  { id: "warm", label: "Warm" },
  { id: "night", label: "Night" },
  { id: "pulse", label: "Pulse" },
] as const;

export type TrackId = (typeof TRACKS)[number]["id"];

export function isTrackId(value: unknown): value is TrackId {
  return TRACKS.some((track) => track.id === value);
}

export function defaultTrack(template: string): TrackId {
  return template === "bold" ? "pulse" : "warm";
}