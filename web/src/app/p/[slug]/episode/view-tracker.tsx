"use client";

import { useEffect } from "react";
import { recordEpisodeViewed } from "./actions";

export function EpisodeViewTracker({ episodeId }: { episodeId: string }) {
  useEffect(() => {
    void recordEpisodeViewed(episodeId, true);
  }, [episodeId]);
  return null;
}
