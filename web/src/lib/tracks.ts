export const TRACKS = [
  { id: "warm", label: "Warm", src: "/tracks/warm.mp3" },
  { id: "night", label: "Night", src: "/tracks/night.mp3" },
  { id: "pulse", label: "Pulse", src: "/tracks/pulse.mp3" },
] as const;

export type TrackId = (typeof TRACKS)[number]["id"];

export function isTrackId(value: unknown): value is TrackId {
  return TRACKS.some((track) => track.id === value);
}

export function defaultTrack(template: string): TrackId {
  if (template === "bold") return "pulse";
  if (template === "filmstrip") return "night";
  return "warm";
}