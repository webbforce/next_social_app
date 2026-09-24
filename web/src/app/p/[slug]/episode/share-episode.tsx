"use client";

import { useState } from "react";
import { recordReelFile, reelFileName, type ReelSlide } from "@/lib/reel-file";
import { createClient } from "@/lib/supabase/client";
import { createPublicEpisodeLink, createReelUpload, finishReelUpload, recordEpisodeShared } from "./actions";

export function ShareEpisode({
  episodeId,
  slug,
  cardUrl,
  headline,
  publicSlug,
  reel = null,
  videoUrl = null,
}: {
  episodeId: string;
  slug: string;
  cardUrl: string;
  headline: string;
  publicSlug: string | null;
  reel?: { slides: ReelSlide[]; hostName: string; activity: string } | null;
  videoUrl?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState(publicSlug);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<{ blob: Blob; name: string } | null>(null);

  async function persistReel(blob: Blob) {
    const prepared = await createReelUpload(slug, episodeId, blob.type);
    if (prepared.error || !prepared.path || !prepared.token) return;
    const { error } = await createClient().storage
      .from("episodes")
      .uploadToSignedUrl(prepared.path, prepared.token, blob);
    if (error) return;
    await finishReelUpload(slug, episodeId, prepared.path);
  }

  async function media() {
    if (!reel) {
      const res = await fetch(cardUrl);
      return { blob: await res.blob(), name: "upfor-episode.png", type: "image/png" };
    }
    if (file) return { ...file, type: file.blob.type };
    if (videoUrl) {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const saved = { blob, name: reelFileName(blob.type) };
      setFile(saved);
      return { ...saved, type: blob.type };
    }
    const recorded = await recordReelFile(reel.slides, reel.hostName, reel.activity);
    setFile(recorded);
    void persistReel(recorded.blob);
    return { ...recorded, type: recorded.blob.type };
  }

  async function download() {
    setError(null);
    setBusy(true);
    try {
      const out = await media();
      const url = URL.createObjectURL(out.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = out.name;
      a.click();
      URL.revokeObjectURL(url);
      void recordEpisodeShared(episodeId, "download");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make that file.");
    } finally {
      setBusy(false);
    }
  }

  async function nativeShare() {
    setError(null);
    setBusy(true);
    try {
      const out = await media();
      const shareFile = new File([out.blob], out.name, { type: out.type });
      if (navigator.canShare?.({ files: [shareFile] })) {
        await navigator.share({ files: [shareFile], text: headline });
      } else if (navigator.share) {
        await navigator.share({ text: headline, url: window.location.href });
      } else {
        await download();
        return;
      }
      void recordEpisodeShared(episodeId, "native");
    } catch {
      // Closing the share sheet rejects.
    } finally {
      setBusy(false);
    }
  }

  async function makePublic() {
    const result = await createPublicEpisodeLink(episodeId, slug);
    if (result.error || !result.publicSlug) {
      setError(result.error ?? "Couldn't create a public link.");
      return;
    }
    const url = `${window.location.origin}/e/${result.publicSlug}`;
    setLink(result.publicSlug);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Share the episode</h2>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void nativeShare()}>
          {busy && reel ? "Making video…" : "Share"}
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void download()}>
          {busy && reel ? "Making video…" : "Download"}
        </button>
        <button type="button" className="btn-secondary col-span-2" onClick={() => void makePublic()}>
          {copied ? "Public link copied" : link ? "Copy public link" : "Create a public link"}
        </button>
      </div>
      <p className="text-xs text-stone-500">
        {reel
          ? videoUrl
            ? "Share and download send the saved reel video. "
            : "Share and download send a short video of the reel. First tap takes a few seconds; we keep it for next time. "
          : ""}
        The public link is off until someone here creates one. Leave out photos you appear in first.
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
