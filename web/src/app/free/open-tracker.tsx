"use client";

import { useEffect } from "react";
import { recordFreePageViewed } from "./actions";

export function OpenTracker({ freePeopleVisible }: { freePeopleVisible: number }) {
  useEffect(() => {
    void recordFreePageViewed(freePeopleVisible);
  }, [freePeopleVisible]);
  return null;
}