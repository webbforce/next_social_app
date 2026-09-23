"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { inAppBrowser, track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import type { Rsvp } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";

type Result = { error: string | null };

const RSVP_ERRORS: Record<string, string> = {
  not_signed_in: "Something went wrong signing you in. Reload and try again.",
  profile_incomplete: "Add your first name and confirm you're 18+ first.",
  plan_not_found: "This plan doesn't exist anymore.",
  host_cannot_rsvp: "You're the host of this plan.",
  plan_closed: "This plan is over, so RSVPs are closed.",
  removed_by_host: "The host removed you from this plan.",
};

// The browser signs guests in anonymously first, so Supabase's per-IP limit applies to the guest, not our server.
export async function submitRsvp(
  slug: string,
  rsvp: Rsvp,
  guest: { firstName: string; confirmed18: boolean } | null,
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
    const { error } = existing
      ? await supabase
          .from("profiles")
          .update({ first_name: firstName, is_18_plus_confirmed: true })
          .eq("id", user.id)
      : await supabase
          .from("profiles")
          .insert({ id: user.id, first_name: firstName, is_18_plus_confirmed: true });
    if (error) return { error: "Couldn't save your name. Try again." };
  }

  const { error } = await supabase.rpc("rsvp", { p_slug: slug, p_rsvp: rsvp });
  if (error) return { error: RSVP_ERRORS[error.message] ?? "Couldn't save your RSVP. Try again." };

  track("rsvp_submitted", user.id, { slug, rsvp, is_guest: user.isAnonymous });
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

export async function removeParticipant(participantId: string, slug: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_participant", { p_participant_id: participantId });
  if (error) return { error: "Couldn't remove them. Try again." };
  revalidatePath(`/p/${slug}`);
  return { error: null };
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
