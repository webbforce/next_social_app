"use client";

import { useState, useTransition } from "react";
import { ReportControl } from "@/app/report/report-control";
import type { MomentView } from "@/lib/moments";
import { toggleExclusion } from "./actions";

export function ExcludeGrid({
  slug,
  moments,
  excludedIds,
  userId,
}: {
  slug: string;
  moments: MomentView[];
  excludedIds: string[];
  userId: string;
}) {
  const [mine, setMine] = useState(new Set(excludedIds));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    const next = !mine.has(id);
    startTransition(async () => {
      const { error } = await toggleExclusion(slug, id, next);
      if (error) {
        setError(error);
        return;
      }
      setError(null);
      setMine((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(id);
        else copy.delete(id);
        return copy;
      });
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Photos you appear in</h2>
      <p className="text-sm text-stone-600">
        Tap any photo that shows you. Those stay out of the episode — no face detection, just you.
      </p>
      <ul className="grid grid-cols-3 gap-1.5">
        {moments.map((m) => {
          const out = mine.has(m.id);
          return (
            <li key={m.id} className="flex flex-col gap-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(m.id)}
                aria-pressed={out}
                className="relative aspect-square w-full overflow-hidden rounded-xl bg-stone-100"
              >
                {m.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className={`size-full object-cover ${out ? "opacity-30" : ""}`} />
                )}
                {out && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                    Left out
                  </span>
                )}
              </button>
              {m.uploaderId !== userId && (
                <ReportControl targetType="moment" targetId={m.id} slug={slug} hasSession />
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
