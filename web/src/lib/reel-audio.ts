import { TRACKS, type TrackId } from "@/lib/tracks";

type Handle = { play: () => Promise<void>; stop: () => void };

export function startTrack(id: TrackId): Handle | null {
  const src = TRACKS.find((track) => track.id === id)?.src;
  if (!src) return null;

  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.5;
  void audio.play().catch(() => {});

  return {
    play: () => audio.play(),
    stop() {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
}
