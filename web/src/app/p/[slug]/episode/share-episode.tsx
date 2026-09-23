"use client";

import { useState } from "react";
import { createPublicEpisodeLink, recordEpisodeShared } from "./actions";

export function ShareEpisode({
  episodeId,
  slug,
  cardUrl,
  headline,
  publicSlug,
}: {
  episodeId: string;
  slug: string;
  cardUrl: string;
  headline: string;
  publicSlug: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState(publicSlug);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    const res = await fetch(cardUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "upfor-episode.png";
    a.click();
    URL.revokeObjectURL(url);
    void recordEpisodeShared(episodeId, "download");
  }

  async function nativeShare() {
    try {
      const res = await fetch(cardUrl);
      const blob = await res.blob();
      const file = new File([blob], "upfor-episode.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: headline });
      } else if (navigator.share) {
        await navigator.share({ text: headline, url: window.location.href });
      } else {
        await download();
        return;
      }
      void recordEpisodeShared(episodeId, "native");
    } catch {
      // Closing the share sheet rejects.
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
        <button type="button" className="btn-primary" onClick={nativeShare}>
          Share
        </button>
        <button type="button" className="btn-secondary" onClick={download}>
          Download
        </button>
        <button type="button" className="btn-secondary col-span-2" onClick={makePublic}>
          {copied ? "Public link copied" : link ? "Copy public link" : "Create a public link"}
        </button>
      </div>
      <p className="text-xs text-stone-500">
        The public link is off until someone here creates one. Leave out photos you appear in first.
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
