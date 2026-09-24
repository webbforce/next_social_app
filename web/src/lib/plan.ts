import "server-only";
import { cache } from "react";
import type { EpisodeHighlights } from "@/lib/episode";
import type { MomentView } from "@/lib/moments";
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
  reclaimable_guests: { id: string; first_name: string; rsvp: Rsvp }[];
};

export const getPlanBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_plan_by_slug", { p_slug: slug });
  if (error) throw new Error(`get_plan_by_slug failed: ${error.message}`);
  if (!data) return null;
  const plan = data as PlanView;
  plan.reclaimable_guests ??= [];
  return plan;
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

export const getPlanMoments = cache(async (planId: string): Promise<MomentView[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("moments")
    .select("id, uploader_id, storage_path, created_at")
    .eq("plan_id", planId)
    .is("removed_at", null)
    .order("created_at");
  if (error) {
    console.error("getPlanMoments failed:", error.message);
    return [];
  }
  if (!data?.length) return [];

  const { data: signed } = await supabase.storage
    .from("moments")
    .createSignedUrls(
      data.map((m) => m.storage_path),
      3600,
    );

  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return data.map((m) => ({
    id: m.id,
    uploaderId: m.uploader_id,
    uploaderName: "Someone",
    storagePath: m.storage_path,
    url: urls.get(m.storage_path) ?? "",
    createdAt: m.created_at,
  }));
});

export type EpisodeView = {
  id: string;
  format: "card" | "reel";
  template: string;
  status: "pending" | "rendering" | "ready" | "failed";
  card_path: string | null;
  music_track: string | null;
  highlights: EpisodeHighlights;
  public_share_slug: string | null;
  ready_at: string | null;
  error: string | null;
};

export const getPlanEpisode = cache(async (planId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("episodes")
    .select("id, format, template, status, card_path, music_track, highlights, public_share_slug, ready_at, error")
    .eq("plan_id", planId)
    .maybeSingle();
  return (data as EpisodeView | null) ?? null;
});
