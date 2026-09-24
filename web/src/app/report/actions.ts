"use server";

import { track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { getPlanBySlug, getPlanMoments } from "@/lib/plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ReportTarget = "plan" | "moment" | "profile";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fileReport({
  slug,
  planId,
  targetType,
  targetId,
  reason,
}: {
  slug?: string;
  planId?: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
}): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Couldn't send that. Reload and try again." };
  if (targetType !== "plan" && targetType !== "moment" && targetType !== "profile") {
    return { error: "Couldn't send that report." };
  }
  if (!UUID.test(targetId)) return { error: "Couldn't send that report." };

  const note = reason.trim();
  if (note.length < 1 || note.length > 500) return { error: "Say what's wrong, in a short note." };

  if (targetType === "profile" && targetId === user.id) {
    return { error: "You can't report yourself." };
  }

  if (slug) {
    const plan = await getPlanBySlug(slug);
    if (!plan) return { error: "This plan doesn't exist anymore." };
    if (targetType === "plan" && targetId !== plan.id) return { error: "Couldn't send that report." };
    if (targetType === "profile") {
      const onPlan =
        plan.host.id === targetId || plan.participants.some((person) => person.user_id === targetId);
      if (!onPlan) return { error: "Couldn't send that report." };
    }
    if (targetType === "moment") {
      const moment = (await getPlanMoments(plan.id)).find((item) => item.id === targetId);
      if (!moment) return { error: "That photo isn't here anymore." };
      if (moment.uploaderId === user.id) return { error: "That's your photo. Remove it instead." };
    }
  } else if (planId && targetType === "plan" && targetId === planId) {
    const admin = createAdminClient();
    const { data } = await admin.from("plans").select("id").eq("id", planId).maybeSingle();
    if (!data) return { error: "This plan doesn't exist anymore." };
  } else {
    return { error: "Couldn't send that report." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("status", "open")
    .maybeSingle();
  if (existing) return { error: null };

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason: note,
  });
  if (error) return { error: "Couldn't send that report. Try again." };

  track("report_filed", user.id, { target_type: targetType, slug: slug ?? null });
  return { error: null };
}
