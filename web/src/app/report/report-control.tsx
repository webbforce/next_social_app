"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { fileReport, type ReportTarget } from "./actions";

const TITLE: Record<ReportTarget, string> = {
  plan: "Report this plan",
  moment: "Report this photo",
  profile: "Report this person",
};

export function ReportControl({
  targetType,
  targetId,
  slug,
  planId,
  hasSession,
  label,
}: {
  targetType: ReportTarget;
  targetId: string;
  slug?: string;
  planId?: string;
  hasSession: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <p className="text-sm text-stone-500">Thanks. We&apos;ll look at it.</p>;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return setError("Say what's wrong, in a short note.");
    setError(null);
    startTransition(async () => {
      if (!hasSession) {
        const { error: signInError } = await createClient().auth.signInAnonymously();
        if (signInError) {
          setError("Couldn't send that. Try again in a minute.");
          return;
        }
      }
      const result = await fileReport({ slug, planId, targetType, targetId, reason });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
      setOpen(false);
    });
  }

  return (
    <>
      <button type="button" className="text-sm text-stone-500 underline" onClick={() => setOpen(true)}>
        {label ?? "Report"}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={submit}
            className="card flex w-full max-w-md flex-col gap-3"
            role="dialog"
            aria-modal
            aria-labelledby="report-title"
          >
            <h2 id="report-title" className="text-lg font-semibold">
              {TITLE[targetType]}
            </h2>
            <p className="text-sm text-stone-600">We&apos;ll look at this. They won&apos;t see your name.</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input min-h-28 py-3"
              placeholder="What's wrong?"
              maxLength={500}
              required
            />
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button className="btn-primary h-11 flex-1 text-sm" disabled={pending}>
                Send report
              </button>
              <button
                type="button"
                className="btn-secondary h-11 flex-1 text-sm"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
