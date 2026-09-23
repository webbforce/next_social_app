"use client";

import { useState, useTransition } from "react";
import type { Rsvp } from "@/lib/plan";
import { createClient } from "@/lib/supabase/client";
import { submitRsvp } from "./actions";

const OPTIONS: { value: Rsvp; label: string }[] = [
  { value: "in", label: "I'm in" },
  { value: "maybe", label: "Maybe" },
  { value: "out", label: "Can't" },
];

export function RsvpPanel({
  slug,
  current,
  hasSession,
  needsProfile,
}: {
  slug: string;
  current: Rsvp | null;
  hasSession: boolean;
  needsProfile: boolean;
}) {
  const [firstName, setFirstName] = useState("");
  const [confirmed18, setConfirmed18] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingChoice, setPendingChoice] = useState<Rsvp | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(rsvp: Rsvp) {
    if (needsProfile && !firstName.trim()) return setError("Add your first name.");
    if (needsProfile && !confirmed18) return setError("Confirm you're 18 or older.");
    setError(null);
    setPendingChoice(rsvp);

    startTransition(async () => {
      if (!hasSession) {
        const { error } = await createClient().auth.signInAnonymously();
        if (error) {
          setError("Couldn't join right now. Try again in a minute.");
          return;
        }
      }
      const result = await submitRsvp(
        slug,
        rsvp,
        needsProfile ? { firstName, confirmed18 } : null,
      );
      if (result.error) setError(result.error);
    });
  }

  return (
    <section className="card flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        {current ? "Your answer" : "Are you in?"}
      </h2>
      {needsProfile && (
        <div className="flex flex-col gap-3">
          <input
            className="input"
            placeholder="Your first name"
            autoComplete="given-name"
            maxLength={40}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-5"
              checked={confirmed18}
              onChange={(e) => setConfirmed18(e.target.checked)}
            />
            <span>I&apos;m 18 or older</span>
          </label>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const selected = (pending ? pendingChoice : current) === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => choose(o.value)}
              disabled={pending}
              aria-pressed={selected}
              className={selected ? "btn-primary px-2" : "btn-secondary px-2"}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {needsProfile && (
        <p className="text-xs text-stone-500">No app or account needed. Only people with the link see your name.</p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
