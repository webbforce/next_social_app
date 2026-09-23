"use client";

import { useActionState } from "react";
import { makeEpisode } from "./actions";

export function MakeEpisodeButton({ slug, label }: { slug: string; label: string }) {
  const [state, action, pending] = useActionState(async () => makeEpisode(slug), { error: null });

  return (
    <form action={action} className="flex flex-col gap-2">
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Making the episode…" : label}
      </button>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
