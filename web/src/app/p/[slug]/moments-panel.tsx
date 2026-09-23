"use client";

import { useRef, useState, useTransition } from "react";
import {
  MAX_PHOTOS_PER_PICK,
  photoExtension,
  validatePhoto,
  type MomentView,
} from "@/lib/moments";
import { createClient } from "@/lib/supabase/client";
import { recordMomentUploaded, removeMoment } from "./actions";

type LocalPhoto = {
  key: string;
  file: File;
  preview: string;
  status: "queued" | "uploading" | "error";
  error?: string;
};

async function imageSize(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

function takenAt(file: File) {
  const t = file.lastModified;
  if (!t || t < Date.parse("2000-01-01") || t > Date.now() + 86_400_000) return null;
  return new Date(t).toISOString();
}

async function uploadPhoto(planId: string, userId: string, item: LocalPhoto) {
  const started = Date.now();
  const supabase = createClient();
  const path = `${planId}/${item.key}.${photoExtension(item.file)}`;

  const { error: storageError } = await supabase.storage.from("moments").upload(path, item.file, {
    contentType: item.file.type || "image/jpeg",
    upsert: false,
  });
  if (storageError) throw storageError;

  const size = await imageSize(item.file);
  const { data, error: rowError } = await supabase
    .from("moments")
    .insert({
      plan_id: planId,
      uploader_id: userId,
      storage_path: path,
      taken_at: takenAt(item.file),
      width: size.width,
      height: size.height,
    })
    .select("id, created_at")
    .single();
  if (rowError) {
    await supabase.storage.from("moments").remove([path]);
    throw rowError;
  }

  const { data: signed } = await supabase.storage.from("moments").createSignedUrl(path, 3600);
  const moment: MomentView = {
    id: data.id,
    uploaderId: userId,
    uploaderName: "You",
    storagePath: path,
    url: signed?.signedUrl ?? item.preview,
    createdAt: data.created_at,
  };

  void recordMomentUploaded(planId, { upload_ms: Date.now() - started, failed: false });
  return moment;
}

export function MomentsPanel({
  planId,
  slug,
  userId,
  isHost,
  canUpload,
  initialMoments,
}: {
  planId: string;
  slug: string;
  userId: string;
  isHost: boolean;
  canUpload: boolean;
  initialMoments: MomentView[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(initialMoments);
  const [local, setLocal] = useState<LocalPhoto[]>([]);
  const localRef = useRef<LocalPhoto[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const uploading = useRef(false);

  function writeLocal(next: LocalPhoto[]) {
    localRef.current = next;
    setLocal(next);
  }

  function queueFiles(list: FileList | null) {
    if (!list?.length) return;
    const next: LocalPhoto[] = [];
    for (const file of Array.from(list).slice(0, MAX_PHOTOS_PER_PICK)) {
      const error = validatePhoto(file);
      next.push({
        key: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        status: error ? "error" : "queued",
        error: error ?? undefined,
      });
    }
    writeLocal([...localRef.current, ...next]);
    if (inputRef.current) inputRef.current.value = "";
    void drain();
  }

  async function drain() {
    if (uploading.current) return;
    uploading.current = true;

    while (true) {
      const item = localRef.current.find((p) => p.status === "queued");
      if (!item) break;
      writeLocal(localRef.current.map((p) => (p.key === item.key ? { ...p, status: "uploading" } : p)));

      try {
        const moment = await uploadPhoto(planId, userId, item);
        URL.revokeObjectURL(item.preview);
        writeLocal(localRef.current.filter((p) => p.key !== item.key));
        setSaved((prev) => [...prev, moment]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed. Try again.";
        writeLocal(
          localRef.current.map((p) =>
            p.key === item.key ? { ...p, status: "error", error: "Couldn't upload that photo. Try again." } : p,
          ),
        );
        void recordMomentUploaded(planId, { upload_ms: 0, failed: true });
        console.error("moment upload failed", message);
      }
    }

    uploading.current = false;
  }

  function retry(key: string) {
    writeLocal(localRef.current.map((p) => (p.key === key ? { ...p, status: "queued", error: undefined } : p)));
    void drain();
  }

  function dropLocal(key: string) {
    const found = localRef.current.find((p) => p.key === key);
    if (found) URL.revokeObjectURL(found.preview);
    writeLocal(localRef.current.filter((p) => p.key !== key));
  }

  function remove(moment: MomentView) {
    if (!confirm("Remove this photo?")) return;
    startTransition(async () => {
      const { error } = await removeMoment(moment.id, slug);
      if (error) {
        alert(error);
        return;
      }
      setSaved((prev) => prev.filter((m) => m.id !== moment.id));
      if (openId === moment.id) setOpenId(null);
    });
  }

  const open = saved.find((m) => m.id === openId);
  const count = saved.length;

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {count} {count === 1 ? "photo" : "photos"}
        </h2>
        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="sr-only"
              onChange={(e) => queueFiles(e.target.files)}
            />
            <button type="button" className="text-sm font-semibold underline" onClick={() => inputRef.current?.click()}>
              Add photos
            </button>
          </>
        )}
      </div>

      {!canUpload && count === 0 && (
        <p className="text-sm text-stone-500">
          Photos can be added once the plan starts, and until 12 hours after it ends.
        </p>
      )}

      {canUpload && count === 0 && local.length === 0 && (
        <button
          type="button"
          className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-stone-300 text-sm text-stone-600"
          onClick={() => inputRef.current?.click()}
        >
          Add photos from your camera roll
        </button>
      )}

      {(count > 0 || local.length > 0) && (
        <ul className="grid grid-cols-3 gap-1.5">
          {saved.map((m) => (
            <li key={m.id} className="relative aspect-square overflow-hidden rounded-xl bg-stone-100">
              <button type="button" className="size-full" onClick={() => setOpenId(m.id)}>
                {m.url ? (
                  // Signed storage URLs expire; a plain img avoids next/image remote config.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={`Photo from ${m.uploaderName}`} className="size-full object-cover" />
                ) : (
                  <span className="sr-only">Photo from {m.uploaderName}</span>
                )}
              </button>
            </li>
          ))}
          {local.map((p) => (
            <li key={p.key} className="relative aspect-square overflow-hidden rounded-xl bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="size-full object-cover" />
              <div className="absolute inset-0 flex items-end bg-black/35 p-1.5">
                {p.status === "uploading" && <span className="text-xs font-medium text-white">Uploading…</span>}
                {p.status === "queued" && <span className="text-xs font-medium text-white">Waiting…</span>}
                {p.status === "error" && (
                  <div className="flex w-full flex-col gap-1">
                    <span className="text-[11px] leading-tight text-white">Failed</span>
                    <div className="flex gap-2">
                      <button type="button" className="text-[11px] font-semibold text-white underline" onClick={() => retry(p.key)}>
                        Retry
                      </button>
                      <button type="button" className="text-[11px] text-white/80 underline" onClick={() => dropLocal(p.key)}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {local.some((p) => p.status === "error") && (
        <p className="text-xs text-stone-500">If a photo fails, tap Retry. Each one uploads on its own.</p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          role="dialog"
          aria-modal
          aria-label="Photo"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <p className="text-sm">{open.uploaderName}</p>
            <button type="button" className="text-sm font-semibold" onClick={() => setOpenId(null)}>
              Close
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.url} alt={`Photo from ${open.uploaderName}`} className="min-h-0 flex-1 object-contain" />
          {(isHost || open.uploaderId === userId) && (
            <div className="p-4">
              <button
                type="button"
                className="btn-secondary w-full text-red-700"
                disabled={busy}
                onClick={() => remove(open)}
              >
                Remove photo
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
