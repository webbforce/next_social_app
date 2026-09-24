"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { inAppBrowser, track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { getPlanBySlug, getPlanUpdates, type Rsvp } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";
import { formatRange } from "@/lib/time";

type Result = { error: string | null };

const RSVP_ERRORS: Record<string, string> = {
  not_signed_in: "Something went wrong signing you in. Reload and try again.",
  profile_incomplete: "Add your first name and confirm you're 18+ first.",
  plan_not_found: "This plan doesn't exist anymore.",
  host_cannot_rsvp: "You're the host of this plan.",
  plan_closed: "This plan is over, so RSVPs are closed.",
  removed_by_host: "The host removed you from this plan.",
  not_a_guest: "Sign out and open the link again to join as a guest.",
  plan_cancelled: "This plan was cancelled.",
  already_on_plan: "You're already on this plan.",
  guest_not_found: "That name isn't on this plan anymore.",
  not_a_guest_row: "That person already has an account.",
};

// The browser signs guests in anonymously first, so Supabase's per-IP limit applies to the guest, not our server.
export async function submitRsvp(
  slug: string,
  rsvp: Rsvp,
  guest: { firstName: string; confirmed18: boolean; photoPath?: string | null } | null,
): Promise<Result> {
  if (!["in", "maybe", "out"].includes(rsvp)) return { error: "Pick in, maybe or can't." };

  const user = await getCurrentUser();
  if (!user) return { error: RSVP_ERRORS.not_signed_in };

  const supabase = await createClient();

  if (guest) {
    const firstName = guest.firstName.trim();
    if (firstName.length < 1 || firstName.length > 40) return { error: "Add your first name." };
    if (!guest.confirmed18) return { error: "You need to be 18 or older to join." };

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    const photoPath = guest.photoPath?.trim() || null;
    const { error } = existing
      ? await supabase
          .from("profiles")
          .update({
            first_name: firstName,
            is_18_plus_confirmed: true,
            ...(photoPath ? { photo_path: photoPath } : {}),
          })
          .eq("id", user.id)
      : await supabase.from("profiles").insert({
          id: user.id,
          first_name: firstName,
          is_18_plus_confirmed: true,
          ...(photoPath ? { photo_path: photoPath } : {}),
        });
    if (error) return { error: "Couldn't save your name. Try again." };
  }

  const { error } = await supabase.rpc("rsvp", { p_slug: slug, p_rsvp: rsvp });
  if (error) return { error: RSVP_ERRORS[error.message] ?? "Couldn't save your RSVP. Try again." };

  track("rsvp_submitted", user.id, { slug, rsvp, is_guest: user.isAnonymous });
  revalidatePath(`/p/${slug}`);
  return { error: null };
}

export async function reclaimGuest(slug: string, participantId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: RSVP_ERRORS.not_signed_in };
  if (!user.isAnonymous) return { error: RSVP_ERRORS.not_a_guest };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reclaim_guest_on_plan", {
    p_slug: slug,
    p_participant_id: participantId,
  });
  if (error) return { error: RSVP_ERRORS[error.message] ?? "Couldn't find you on this plan. Try again." };

  track("guest_rejoined_by_name", user.id, { slug, participant_id: participantId });
  revalidatePath(`/p/${slug}`);
  return { error: null };
}

export async function postUpdate(planId: string, slug: string, _prev: Result, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 1 || body.length > 280) return { error: "Updates are 1 to 280 characters." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_updates")
    .insert({ plan_id: planId, author_id: user.id, body });
  if (error) return { error: "Only people who are in or maybe can post updates." };

  revalidatePath(`/p/${slug}`);
  return { error: null };
}

export async function leavePlan(slug: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_plan", { p_slug: slug });
  if (error) return { error: "Couldn't remove you from this plan. Try again." };

  revalidatePath(`/p/${slug}`);
  return { error: null };
}

export async function removeParticipant(participantId: string, slug: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_participant", { p_participant_id: participantId });
  if (error) return { error: "Couldn't remove them. Try again." };
  revalidatePath(`/p/${slug}`);
  return { error: null };
}

const HOUR_MS = 60 * 60 * 1000;

export async function updatePlan(planId: string, slug: string, formData: FormData): Promise<Result> {
  const user = await getCurrentUser();
  if (!user || user.isAnonymous) return { error: "Sign in as the host to edit." };

  const plan = await getPlanBySlug(slug);
  if (!plan || plan.id !== planId) return { error: "This plan doesn't exist anymore." };
  if (!plan.is_host) return { error: "Only the host can edit this plan." };
  if (plan.status !== "open" && plan.status !== "happening") {
    return { error: "This plan is over, so the time and place stay as they are." };
  }

  const startsAt = new Date(String(formData.get("starts_at")));
  const endsAt = new Date(String(formData.get("ends_at")));
  const place = String(formData.get("place") ?? "").trim();

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

  const isUrl = /^https?:\/\/\S+$/i.test(place);
  if (isUrl ? place.length > 500 : place.length > 120) {
    return { error: "That place is too long." };
  }

  const placeText = place && !isUrl ? place : null;
  const placeUrl = isUrl ? place : null;
  const atMinute = (d: Date) => Math.floor(d.getTime() / 60_000);
  const timeChanged =
    atMinute(new Date(plan.starts_at)) !== atMinute(startsAt) ||
    atMinute(new Date(plan.ends_at)) !== atMinute(endsAt);
  const placeChanged = plan.place_text !== placeText || plan.place_url !== placeUrl;
  if (!timeChanged && !placeChanged) return { error: null };

  const nextStarts = timeChanged ? startsAt.toISOString() : plan.starts_at;
  const nextEnds = timeChanged ? endsAt.toISOString() : plan.ends_at;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .update({
      starts_at: nextStarts,
      ends_at: nextEnds,
      place_text: placeText,
      place_url: placeUrl,
    })
    .eq("id", planId)
    .eq("host_id", user.id)
    .is("cancelled_at", null)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't save those changes. Try again." };

  const range = formatRange(new Date(nextStarts), new Date(nextEnds));
  const notice = [
    timeChanged ? `now ${range}` : null,
    placeChanged ? (placeText ? `now at ${placeText}` : placeUrl ? "updated the location" : "removed the place") : null,
  ]
    .filter(Boolean)
    .join(", ");

  await supabase.from("plan_updates").insert({
    plan_id: planId,
    author_id: user.id,
    body: `Updated: ${notice}`.slice(0, 280),
  });

  track("plan_edited", user.id, { plan_id: planId, time_changed: timeChanged, place_changed: placeChanged });
  revalidatePath(`/p/${slug}`);
  return { error: null };
}

export async function refreshPlanSnapshot(slug: string) {
  const plan = await getPlanBySlug(slug);
  if (!plan) return null;
  const isMember = plan.is_host || plan.my_rsvp !== null;
  return { plan, updates: isMember ? await getPlanUpdates(plan.id) : null };
}

export async function cancelPlan(planId: string, slug: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", planId)
    .is("cancelled_at", null)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't cancel the plan. Try again." };
  revalidatePath(`/p/${slug}`);
  return { error: null };
}

export async function resetShareLink(planId: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reset_share_slug", { p_plan_id: planId });
  if (error || !data) return { error: "Couldn't reset the link. Try again." };
  redirect(`/p/${data}`);
}

export async function recordPlanOpened(slug: string, referrer: string) {
  const [user, headerList] = await Promise.all([getCurrentUser(), headers()]);
  track("plan_link_opened", user?.id ?? null, {
    slug,
    is_known_guest: !!user?.isAnonymous,
    referrer: referrer || null,
    in_app_browser: inAppBrowser(headerList.get("user-agent")),
  });
}

export async function recordLinkShared(planId: string, channel: "whatsapp" | "imessage" | "copy" | "native") {
  const user = await getCurrentUser();
  track("plan_link_shared", user?.id ?? null, { plan_id: planId, channel });
}

export async function recordMomentUploaded(
  planId: string,
  properties: { upload_ms: number; failed: boolean },
) {
  const user = await getCurrentUser();
  track("moment_uploaded", user?.id ?? null, {
    plan_id: planId,
    is_guest: user?.isAnonymous ?? true,
    ...properties,
  });
}

export async function removeMoment(momentId: string, slug: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_moment", { p_moment_id: momentId });
  if (error) return { error: "Couldn't remove that photo. Try again." };

  revalidatePath(`/p/${slug}`);
  return { error: null };
}
