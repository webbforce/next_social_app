"use server";

import { track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";

export async function recordPublicOpened(slug: string, referrer: string) {
  const user = await getCurrentUser();
  track("public_episode_opened", user?.id ?? null, { slug, referrer: referrer || null });
}
