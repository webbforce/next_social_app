import "server-only";
import { cache } from "react";
import type { EpisodeHighlights } from "@/lib/episode";
import type { MomentView } from "@/lib/moments";
import { createClient } from "@/lib/supabase/server";
import type { PlanUpdate, PlanView } from "@/lib/plan-view";

export type { Person, PlanStatus, PlanUpdate, PlanView, Rsvp } from "@/lib/plan-view";
export { planHeadline } from "@/lib/plan-view";

export const getPlanBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_plan_by_slug", { p_slug: slug });
  if (error) throw new Error(`get_plan_by_slug failed: ${error.message}`);
  if (!data) return null;
  const plan = data as PlanView;
  plan.reclaimable_guests ??= [];
  return plan;
});

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

export const getPlanUpdates = cache(async (planId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_updates")
    .select("id, body, created_at, author:profiles(id, first_name)")
    .eq("plan_id", planId)
    .order("created_at")
    .returns<PlanUpdate[]>();
  return data ?? [];
});

export const getPlanEpisode = cache(async (planId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("episodes")
    .select("id, format, template, status, card_path, music_track, highlights, public_share_slug, ready_at, error")
    .eq("plan_id", planId)
    .maybeSingle();
  return (data as EpisodeView | null) ?? null;
});
