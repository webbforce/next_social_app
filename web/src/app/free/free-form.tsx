"use client";

import { useState, useTransition } from "react";
import { FREE_INTENT_LABEL, FREE_INTENTS, type FreeIntent } from "@/lib/free";
import { clearFree, setFree } from "./actions";

export function FreeForm({
  active,
}: {
  active: FreeIntent | null | undefined;
}) {
  const isFree = active !== undefined;
  const [intent, setIntent] = useState<FreeIntent | null>(active ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: FreeIntent | null) {
    setError(null);
    startTransition(async () => {
      const result = await setFree(next);
      if (result.error) setError(result.error);
    });
  }

  function clear() {
    setError(null);
    startTransition(async () => {
      const result = await clearFree();
      if (result.error) setError(result.error);
    });
  }

  return (
    <section className="card flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{isFree ? "You're free tonight" : "I'm free tonight"}</h2>
      <p className="text-sm text-stone-600">
        People you&apos;ve made plans with can see this until 04:00.
      </p>
      <div className="flex flex-wrap gap-2">
        {FREE_INTENTS.map((tag) => (
          <button
            key={tag}
            type="button"
            disabled={pending}
            aria-pressed={intent === tag}
            onClick={() => {
              const next = intent === tag ? null : tag;
              setIntent(next);
              if (isFree) save(next);
            }}
            className={`h-10 rounded-full border px-4 text-sm font-medium ${
              intent === tag ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white"
            }`}
          >
            {FREE_INTENT_LABEL[tag]}
          </button>
        ))}
      </div>
      {isFree ? (
        <button type="button" className="btn-secondary" disabled={pending} onClick={clear}>
          Not anymore
        </button>
      ) : (
        <button type="button" className="btn-primary" disabled={pending} onClick={() => save(intent)}>
          I&apos;m free tonight
        </button>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}