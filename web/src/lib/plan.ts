import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { whenPhrase } from "@/lib/time";

export type Rsvp = "in" | "maybe" | "out";
export type PlanStatus = "open" | "happening" | "ended" | "cancelled";

export type Person = { id: string; first_name: string; photo_path: string | null };

// Shape returned by public.get_plan_by_slug().
export type PlanView = {
  id: string;
  activity: string;
  activity_tag: string | null;
  starts_at: string;
  ends_at: string;
  place_text: string | null;
  place_url: string | null;
  status: PlanStatus;
  host: Person;
  is_host: boolean;
  my_rsvp: Rsvp | null;
  am_removed: boolean;
  in_count: number;
  participants: { id: string; user_id: string; first_name: string; photo_path: string | null; rsvp: Rsvp }[];
};

export const getPlanBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_plan_by_slug", { p_slug: slug });
  if (error) throw new Error(`get_plan_by_slug failed: ${error.message}`);
  return data as PlanView | null;
});

// Link preview title, e.g. "Tom is up for drinks tonight at 21:00 · 7 people are in".
export function planHeadline(plan: PlanView) {
  const who = plan.host.first_name;
  if (plan.status === "cancelled") return `${who}'s plan for ${plan.activity} was cancelled`;
  if (plan.status === "ended") return `${who} was up for ${plan.activity}`;

  const when = plan.status === "happening" ? "right now" : whenPhrase(new Date(plan.starts_at));
  const count = plan.in_count > 1 ? ` · ${plan.in_count} people are in` : "";
  return `${who} is up for ${plan.activity} ${when}${count}`;
}
