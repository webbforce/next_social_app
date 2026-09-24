"use client";

import { useState, useTransition } from "react";
import type { PlanView } from "@/lib/plan-view";
import { cancelPlan, removeParticipant, resetShareLink } from "./actions";
import { EditPlanForm } from "./edit-plan";

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

export function HostTools({ plan, slug }: { plan: PlanView; slug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary h-10 text-sm"
          disabled={pending}
          onClick={() => setEditing((open) => !open)}
        >
          {editing ? "Close edit" : "Edit time or place"}
        </button>
        <button
          type="button"
          className="btn-secondary h-10 text-sm"
          disabled={pending}
          onClick={() => {
            if (!confirm("Make a new link? The current link will stop working for anyone who hasn't joined yet.")) return;
            startTransition(async () => setError((await resetShareLink(plan.id)).error));
          }}
        >
          Reset link
        </button>
        <button
          type="button"
          className="btn-secondary h-10 text-sm text-red-700"
          disabled={pending}
          onClick={() => {
            if (!confirm("Cancel this plan? Everyone with the link will see it's off.")) return;
            startTransition(async () => setError((await cancelPlan(plan.id, slug)).error));
          }}
        >
          Cancel plan
        </button>
      </div>
      {editing && <EditPlanForm plan={plan} slug={slug} onSaved={() => setEditing(false)} />}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
