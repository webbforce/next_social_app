"use client";

import { useTransition } from "react";
import { leavePlan } from "./actions";

export function LeavePlanButton({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="text-sm text-stone-500 underline disabled:opacity-50"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove your name and photos from this plan?")) return;
        startTransition(async () => {
          const { error } = await leavePlan(slug);
          if (error) alert(error);
        });
      }}
    >
      {pending ? "Removing…" : "Remove me from this plan"}
    </button>
  );
}
