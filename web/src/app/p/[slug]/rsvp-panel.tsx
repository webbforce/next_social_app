"use client";

import { useState, useTransition } from "react";
import { PhotoField } from "@/components/photo-field";
import type { Rsvp } from "@/lib/plan";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatarFile } from "@/lib/upload-avatar";
import { reclaimGuest, submitRsvp } from "./actions";

const OPTIONS: { value: Rsvp; label: string }[] = [
  { value: "in", label: "I'm in" },
  { value: "maybe", label: "Maybe" },
  { value: "out", label: "Can't" },
];

type Guest = { id: string; first_name: string };

export function RsvpPanel({
  slug,
  current,
  hasSession,
  needsProfile,
  reclaimableGuests,
  allowNewRsvp,
}: {
  slug: string;
  current: Rsvp | null;
  hasSession: boolean;
  needsProfile: boolean;
  reclaimableGuests: Guest[];
  allowNewRsvp: boolean;
}) {
  const [firstName, setFirstName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [confirmed18, setConfirmed18] = useState(false);
  const [someoneNew, setSomeoneNew] = useState(reclaimableGuests.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [pendingChoice, setPendingChoice] = useState<Rsvp | null>(null);
  const [pending, startTransition] = useTransition();

  const showReclaim = needsProfile && !current && reclaimableGuests.length > 0 && !someoneNew;
  const showNameForm = needsProfile && allowNewRsvp && (someoneNew || reclaimableGuests.length === 0);

  async function ensureGuestSession() {
    if (hasSession) return true;
    const { error: signInError } = await createClient().auth.signInAnonymously();
    if (signInError) {
      setError("Couldn't join right now. Try again in a minute.");
      return false;
    }
    return true;
  }

  function choose(rsvp: Rsvp) {
    if (needsProfile && !firstName.trim()) return setError("Add your first name.");
    if (needsProfile && !confirmed18) return setError("Confirm you're 18 or older.");
    setError(null);
    setPendingChoice(rsvp);

    startTransition(async () => {
      if (!(await ensureGuestSession())) return;
      let photoPath: string | null = null;
      if (needsProfile && photo) {
        const {
          data: { user },
        } = await createClient().auth.getUser();
        if (!user) {
          setError("Couldn't join right now. Try again in a minute.");
          return;
        }
        try {
          photoPath = await uploadAvatarFile(user.id, photo);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't save that photo.");
          return;
        }
      }
      const result = await submitRsvp(
        slug,
        rsvp,
        needsProfile ? { firstName, confirmed18, photoPath } : null,
      );
      if (result.error) setError(result.error);
    });
  }

  function pickName(guest: Guest) {
    setError(null);
    startTransition(async () => {
      if (!(await ensureGuestSession())) return;
      const result = await reclaimGuest(slug, guest.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <section className="card flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        {current ? "Your answer" : showReclaim ? "Is this you?" : "Are you in?"}
      </h2>

      {showReclaim && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-stone-600">
            If you already joined from this link, pick your name. WhatsApp sometimes forgets you.
          </p>
          <div className="flex flex-wrap gap-2">
            {reclaimableGuests.map((guest) => (
              <button
                key={guest.id}
                type="button"
                onClick={() => pickName(guest)}
                disabled={pending}
                className="btn-secondary px-4"
              >
                {guest.first_name}
              </button>
            ))}
          </div>
          {allowNewRsvp && (
            <button
              type="button"
              onClick={() => {
                setSomeoneNew(true);
                setError(null);
              }}
              className="text-left text-sm font-medium text-stone-600 underline"
            >
              No, I&apos;m someone new
            </button>
          )}
        </div>
      )}

      {showNameForm && (
        <div className="flex flex-col gap-3">
          {reclaimableGuests.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSomeoneNew(false);
                setError(null);
              }}
              className="text-left text-sm font-medium text-stone-600 underline"
            >
              Is this you?
            </button>
          )}
          <input
            className="input"
            placeholder="Your first name"
            autoComplete="given-name"
            maxLength={40}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <PhotoField onFile={setPhoto} />
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

      {allowNewRsvp && !showReclaim && (
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
      )}

      {showNameForm && (
        <p className="text-xs text-stone-500">No app or account needed. Only people with the link see your name.</p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
