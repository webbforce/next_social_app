"use client";

import { useActionState, useEffect, useRef } from "react";
import { postUpdate } from "./actions";

export function UpdateForm({ planId, slug }: { planId: string; slug: string }) {
  const [state, action, pending] = useActionState(postUpdate.bind(null, planId, slug), { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="body"
          className="input h-11"
          placeholder="Running 10 min late…"
          maxLength={280}
          required
        />
        <button className="btn-primary h-11 shrink-0" disabled={pending}>
          Post
        </button>
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
