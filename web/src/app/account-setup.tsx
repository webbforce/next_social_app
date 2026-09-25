"use client";

import { useState, useTransition } from "react";
import { recordSignupCompleted } from "@/app/login/actions";
import { PhotoField } from "@/components/photo-field";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatarFile } from "@/lib/upload-avatar";

const CLAIM_KEY = "upfor.signupClaim";

export function AccountSetup({
  campuses,
  firstName: initialName,
  onDone,
}: {
  campuses: { id: string; name: string }[];
  firstName: string;
  onDone: () => void;
}) {
  const [firstName, setFirstName] = useState(initialName);
  const [confirmed18, setConfirmed18] = useState(false);
  const [campusId, setCampusId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Sign in again from the start.");
        return;
      }
      let photoPath: string | undefined;
      if (photo) {
        try {
          photoPath = await uploadAvatarFile(user.id, photo);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't save that photo.");
          return;
        }
      }
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        first_name: firstName.trim(),
        is_18_plus_confirmed: true,
        campus_id: campusId || null,
        ...(photoPath ? { photo_path: photoPath } : {}),
      });
      if (error) {
        setError(error.message);
        return;
      }
      const claimed = sessionStorage.getItem(CLAIM_KEY) === "1";
      sessionStorage.removeItem(CLAIM_KEY);
      await recordSignupCompleted("direct", claimed);
      onDone();
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">What should we call you?</h1>
        <p className="text-lg text-stone-600">Then we&apos;ll show you how a plan works.</p>
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">First name</span>
        <input
          className="input"
          autoComplete="given-name"
          maxLength={40}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          autoFocus
        />
      </label>
      <PhotoField onFile={setPhoto} />
      {campuses.length > 0 && (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Campus (optional)</span>
          <select className="input" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
            <option value="">Skip</option>
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-5"
          checked={confirmed18}
          onChange={(e) => setConfirmed18(e.target.checked)}
          required
        />
        <span>I&apos;m 18 or older</span>
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary" disabled={pending || !firstName.trim() || !confirmed18}>
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
