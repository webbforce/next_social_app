"use client";

import { useState } from "react";
import { validateAvatar } from "@/lib/avatars";

export function PhotoField({
  label = "Photo (optional)",
  onFile,
}: {
  label?: string;
  onFile: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <span className="inline-flex size-14 shrink-0 overflow-hidden rounded-full bg-stone-200">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : null}
        </span>
        <input
          className="min-w-0 flex-1 text-sm"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (!file) {
              setPreview(null);
              setError(null);
              onFile(null);
              return;
            }
            const problem = validateAvatar(file);
            if (problem) {
              setError(problem);
              onFile(null);
              return;
            }
            setError(null);
            setPreview(URL.createObjectURL(file));
            onFile(file);
          }}
        />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </label>
  );
}
