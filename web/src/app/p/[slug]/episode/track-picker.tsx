"use client";

import { useState, useTransition } from "react";
import { setEpisodeTrack } from "./actions";
import { TRACKS, type TrackId } from "@/lib/tracks";

export function TrackPicker({
  slug,
  episodeId,
  current,
}: {
  slug: string;
  episodeId: string;
  current: TrackId;
}) {
  const [selected, setSelected] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pick(id: TrackId) {
    if (id === selected) return;
    setSelected(id);
    setError(null);
    startTransition(async () => {
      const result = await setEpisodeTrack(slug, episodeId, id);
      if (result.error) {
        setSelected(current);
        setError(result.error);
      }
    });
  }

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Background music</h2>
      <p className="text-sm text-stone-600">Plays under the reel. Anyone here can change it.</p>
      <div className="flex flex-wrap gap-2">
        {TRACKS.map((track) => (
          <button
            key={track.id}
            type="button"
            disabled={pending}
            aria-pressed={selected === track.id}
            onClick={() => pick(track.id)}
            className={`h-10 rounded-full border px-4 text-sm font-medium ${
              selected === track.id
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-300 bg-white"
            }`}
          >
            {track.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}