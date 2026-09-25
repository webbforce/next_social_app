"use client";

import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand";
import { startTrack } from "@/lib/reel-audio";
import type { TrackId } from "@/lib/tracks";

export type ReelSlide = { url: string; ms: number };

const END_MS = 1600;

export function ReelPlayer({
  slides,
  hostName,
  activity,
  trackId,
  link,
}: {
  slides: ReelSlide[];
  hostName: string;
  activity: string;
  trackId: TrackId;
  link: string;
}) {
  const [index, setIndex] = useState(0);
  const audio = useRef<ReturnType<typeof startTrack>>(null);
  const total = slides.length + 1;
  const onEndCard = index >= slides.length;

  useEffect(() => {
    const ms = onEndCard ? END_MS : slides[index]?.ms;
    if (!ms) return;
    const timer = window.setTimeout(() => {
      setIndex((i) => (i + 1 < total ? i + 1 : 0));
    }, ms);
    return () => window.clearTimeout(timer);
  }, [index, onEndCard, slides, total]);

  useEffect(() => {
    audio.current?.stop();
    audio.current = startTrack(trackId);
    return () => {
      audio.current?.stop();
      audio.current = null;
    };
  }, [trackId]);

  if (!slides.length) return null;

  return (
    <button
      type="button"
      onClick={() => {
        void audio.current?.play();
        setIndex(0);
      }}
      className="relative aspect-[9/16] w-full overflow-hidden rounded-3xl border border-stone-200 bg-ink text-left"
      aria-label="Replay the reel"
    >
      {onEndCard ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink px-8 text-center text-paper">
          <BrandMark size={48} />
          <p className="text-sm font-medium text-paper/60">made with upFor</p>
          <p className="text-sm text-paper/60">{link}</p>
          <p className="text-2xl font-bold">{hostName} was up for {activity}</p>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slides[index].url} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      <div className="absolute inset-x-3 top-3 flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-0.5 flex-1 rounded-full ${i <= index ? "bg-white" : "bg-white/30"}`}
          />
        ))}
      </div>
    </button>
  );
}