"use client";

import { useEffect } from "react";
import { recordPlanOpened } from "./actions";

// Runs in the browser so link-preview crawlers aren't counted as opens.
export function OpenTracker({ slug }: { slug: string }) {
  useEffect(() => {
    void recordPlanOpened(slug, document.referrer);
  }, [slug]);
  return null;
}
