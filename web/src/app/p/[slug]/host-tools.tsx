"use client";

import { useState, useTransition } from "react";
import { cancelPlan, removeParticipant, resetShareLink } from "./actions";

export function RemoveButton({ participantId, name, slug }: { participantId: string; name: string; slug: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-stone-500 underline disabled:opacity-50"
      onClick={() => {
        if (!confirm(`Remove ${name} from this plan? They won't be able to rejoin.`)) return;
        startTransition(async () => {
          const { error } = await removeParticipant(participantId, slug);
          if (error) alert(error);
        });
      }}
    >
      Remove
    </button>
  );
}

export function HostTools({ planId, slug, canCancel }: { planId: string; slug: string; canCancel: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary h-10 text-sm"
          disabled={pending}
          onClick={() => {
            if (!confirm("Make a new link? The current link will stop working for anyone who hasn't joined yet.")) return;
            startTransition(async () => setError((await resetShareLink(planId)).error));
          }}
        >
          Reset link
        </button>
        {canCancel && (
          <button
            type="button"
            className="btn-secondary h-10 text-sm text-red-700"
            disabled={pending}
            onClick={() => {
              if (!confirm("Cancel this plan? Everyone with the link will see it's off.")) return;
              startTransition(async () => setError((await cancelPlan(planId, slug)).error));
            }}
          >
            Cancel plan
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
