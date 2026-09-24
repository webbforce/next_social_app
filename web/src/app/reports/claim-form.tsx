"use client";

import { useState, useTransition } from "react";
import { claimReportsAdmin } from "./actions";

export function ClaimReportsForm() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="card flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await claimReportsAdmin(secret);
          setError(result.error);
        });
      }}
    >
      <p className="text-sm text-stone-600">Enter the reports key from the server env to open the inbox.</p>
      <input
        className="input"
        type="password"
        autoComplete="off"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        required
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary" disabled={pending || !secret.trim()}>
        {pending ? "Checking…" : "Open inbox"}
      </button>
    </form>
  );
}
