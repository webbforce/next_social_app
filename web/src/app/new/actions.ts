"use server";

import { redirect } from "next/navigation";
import { isActivityTag } from "@/lib/activities";
import { track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { parsePlaceFields } from "@/lib/place";
import { createClient } from "@/lib/supabase/server";

export type CreatePlanState = { error: string | null };

const HOUR_MS = 60 * 60 * 1000;

export async function createPlan(_prev: CreatePlanState, formData: FormData): Promise<CreatePlanState> {
  const user = await getCurrentUser();
  if (!user || user.isAnonymous) redirect("/login?next=/new");

  const activity = String(formData.get("activity") ?? "").trim();
  const tag = formData.get("activity_tag");
  const startsAt = new Date(String(formData.get("starts_at")));
  const endsAt = new Date(String(formData.get("ends_at")));
  const parsedPlace = parsePlaceFields(
    String(formData.get("place") ?? ""),
    String(formData.get("place_lat") ?? ""),
    String(formData.get("place_lng") ?? ""),
  );

  if (activity.length < 1 || activity.length > 80) {
    return { error: "Say what you're up for in 80 characters or less." };
  }
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { error: "Pick a start time." };
  }
  if (startsAt.getTime() < Date.now() - HOUR_MS) return { error: "That start time has passed." };
  if (startsAt.getTime() > Date.now() + 60 * 24 * HOUR_MS) {
    return { error: "Plans can be at most two months ahead." };
  }
  if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 24 * HOUR_MS) {
    return { error: "A plan can last up to 24 hours." };
  }

  if (!parsedPlace.ok) return { error: parsedPlace.error };

  const source = formData.get("source") === "free_page" ? "free_page" : "web_create";

  const supabase = await createClient();

  const [{ count: previousPlans }, { count: guestRsvps }] = await Promise.all([
    supabase.from("plans").select("id", { count: "exact", head: true }).eq("host_id", user.id),
    supabase
      .from("plan_participants")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const { data: plan, error } = await supabase
    .from("plans")
    .insert({
      host_id: user.id,
      activity,
      activity_tag: isActivityTag(tag) ? tag : null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      place_text: parsedPlace.place.placeText,
      place_url: parsedPlace.place.placeUrl,
      source,
    })
    .select("id, share_slug")
    .single();

  if (error) return { error: "Couldn't create the plan. Try again." };

  track("plan_created", user.id, {
    plan_id: plan.id,
    source,
    activity: isActivityTag(tag) ? tag : "free_text",
    is_first_plan: (previousPlans ?? 0) === 0,
    hosted_before_as_guest: (guestRsvps ?? 0) > 0,
  });

  redirect(`/p/${plan.share_slug}?new=1`);
}
