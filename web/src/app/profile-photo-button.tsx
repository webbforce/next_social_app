"use client";

import { useState, useTransition } from "react";
import { PhotoField } from "@/components/photo-field";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatarFile } from "@/lib/upload-avatar";

export function ProfilePhotoButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (saved) return <p className="text-center text-sm text-stone-500">Photo saved.</p>;
  if (!open) {
    return (
      <button type="button" className="text-center text-sm text-stone-500 underline" onClick={() => setOpen(true)}>
        Add a profile photo
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <PhotoField
        label="Profile photo"
        onFile={(file) => {
          if (!file) return;
          setError(null);
          startTransition(async () => {
            const supabase = createClient();
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
              setError("Sign in again to add a photo.");
              return;
            }
            try {
              const path = await uploadAvatarFile(user.id, file);
              const { error: updateError } = await supabase.from("profiles").update({ photo_path: path }).eq("id", user.id);
              if (updateError) throw updateError;
              setSaved(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't save that photo.");
            }
          });
        }}
      />
      {pending && <p className="text-sm text-stone-500">Saving…</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
