import "server-only";
import { cache } from "react";
import type { EpisodeHighlights } from "@/lib/episode";
import type { MomentView } from "@/lib/moments";
import { createClient } from "@/lib/supabase/server";
import { planStatus, type MyPlan, type PlanUpdate, type PlanView } from "@/lib/plan-view";

export type { MyPlan, Person, PlanStatus, PlanUpdate, PlanView, Rsvp } from "@/lib/plan-view";
export { planHeadline, planStatus } from "@/lib/plan-view";

export const getPlanBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_plan_by_slug", { p_slug: slug });
  if (error) throw new Error(`get_plan_by_slug failed: ${error.message}`);
  if (!data) return null;
  const plan = data as PlanView;
  plan.reclaimable_guests ??= [];
  return attachAvatarUrls(plan);
});

async function attachAvatarUrls(plan: PlanView) {
  const supabase = await createClient();
  const paths = [plan.host.photo_path, ...plan.participants.map((person) => person.photo_path)].filter(
    (path): path is string => !!path,
  );
  const unique = [...new Set(paths)];
  if (!unique.length) return plan;
  const { data } = await supabase.storage.from("avatars").createSignedUrls(unique, 3600);
  const urls = new Map((data ?? []).filter((row) => row.path && row.signedUrl).map((row) => [row.path, row.signedUrl]));
  plan.host.photo_url = plan.host.photo_path ? (urls.get(plan.host.photo_path) ?? null) : null;
  for (const person of plan.participants) {
    person.photo_url = person.photo_path ? (urls.get(person.photo_path) ?? null) : null;
  }
  return plan;
}

type ParticipantBits = {
  rsvp: string;
  removed_at: string | null;
  left_at: string | null;
};

type PlanBits = {
  id: string;
  activity: string;
  starts_at: string;
  ends_at: string;
  place_text: string | null;
  cancelled_at: string | null;
  share_slug: string;
  host_id: string;
  profiles: { first_name: string } | { first_name: string }[] | null;
  plan_participants: ParticipantBits[] | null;
  episodes: { status: string } | { status: string }[] | null;
};

const PLAN_LIST_COLUMNS =
  "id, activity, starts_at, ends_at, place_text, cancelled_at, share_slug, host_id, profiles!plans_host_id_fkey(first_name), plan_participants(rsvp, removed_at, left_at), episodes(status)";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function peopleIn(rows: ParticipantBits[] | null) {
  const going = (rows ?? []).filter((row) => row.rsvp === "in" && !row.removed_at && !row.left_at).length;
  return going + 1;
}

function toMyPlan(row: PlanBits, userId: string, rsvp: "in" | "maybe" | null): MyPlan {
  const hosting = row.host_id === userId;
  return {
    id: row.id,
    slug: row.share_slug,
    activity: row.activity,
    place: row.place_text,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: planStatus(row.starts_at, row.ends_at, row.cancelled_at),
    role: hosting ? "host" : "guest",
    rsvp: hosting ? null : rsvp,
    hostName: one(row.profiles)?.first_name ?? "Someone",
    inCount: peopleIn(row.plan_participants),
    episodeReady: one(row.episodes)?.status === "ready",
  };
}

// Every plan this account hosts or is still in. Several can be open or happening at once.
export async function getMyPlans(userId: string): Promise<MyPlan[]> {
  const supabase = await createClient();
  const [hosted, joined] = await Promise.all([
    supabase.from("plans").select(PLAN_LIST_COLUMNS).eq("host_id", userId).returns<PlanBits[]>(),
    supabase
      .from("plan_participants")
      .select(`rsvp, plans(${PLAN_LIST_COLUMNS})`)
      .eq("user_id", userId)
      .is("removed_at", null)
      .is("left_at", null)
      .in("rsvp", ["in", "maybe"])
      .returns<{ rsvp: "in" | "maybe"; plans: PlanBits | PlanBits[] | null }[]>(),
  ]);

  if (hosted.error) console.error("getMyPlans hosted:", hosted.error.message);
  if (joined.error) console.error("getMyPlans joined:", joined.error.message);

  const byId = new Map<string, MyPlan>();
  for (const row of hosted.data ?? []) byId.set(row.id, toMyPlan(row, userId, null));
  for (const row of joined.data ?? []) {
    const plan = one(row.plans);
    if (!plan || byId.has(plan.id)) continue;
    byId.set(plan.id, toMyPlan(plan, userId, row.rsvp));
  }
  return [...byId.values()];
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
  video_path: string | null;
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
    .select("id, format, template, status, card_path, video_path, music_track, highlights, public_share_slug, ready_at, error")
    .eq("plan_id", planId)
    .maybeSingle();
  return (data as EpisodeView | null) ?? null;
});
