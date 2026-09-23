"use client";

import { useEffect } from "react";
import { recordPublicOpened } from "./actions";

export function PublicEpisodeTracker({ slug }: { slug: string }) {
  useEffect(() => {
    void recordPublicOpened(slug, document.referrer);
  }, [slug]);
  return null;
}
