"use server";

import { track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Entry = "direct" | "plan_page" | "episode_page" | "public_episode";

export async function recordSignupStarted(entry: Entry) {
  track("host_signup_started", null, { entry });
}

export async function recordSignupCompleted(entry: Entry, claimedGuest: boolean) {
  const user = await getCurrentUser();
  if (!user || user.isAnonymous) return;

  track("host_signup_completed", user.id, { entry });

  if (claimedGuest) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("plan_participants")
      .select("rsvp_at")
      .eq("user_id", user.id)
      .order("rsvp_at")
      .limit(1)
      .maybeSingle();
    const days = data ? Math.floor((Date.now() - Date.parse(data.rsvp_at)) / 86_400_000) : null;
    track("guest_claimed", user.id, { days_since_first_guest_rsvp: days });
  }
}
