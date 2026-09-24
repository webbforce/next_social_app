"use server";

import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ReportRow = {
  id: string;
  target_type: "plan" | "moment" | "profile";
  target_id: string;
  reason: string;
  status: "open" | "actioned" | "dismissed";
  created_at: string;
  reporter_name: string;
  target_label: string;
};

function secretsMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function currentReportsAdmin() {
  const user = await getCurrentUser();
  if (!user || user.isAnonymous) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!error && data?.is_admin) return true;
  return process.env.NODE_ENV !== "production" && !process.env.REPORTS_SECRET;
}

export async function claimReportsAdmin(secret: string): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!user || user.isAnonymous) return { error: "Sign in as a host first." };
  const expected = process.env.REPORTS_SECRET;
  if (!expected) return { error: "Add REPORTS_SECRET on the server, then try again." };
  if (!secretsMatch(secret.trim(), expected)) return { error: "That key didn't match." };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ is_admin: true }).eq("id", user.id);
  if (error) return { error: "Couldn't save admin access. Apply the reports migration first." };
  revalidatePath("/reports");
  return { error: null };
}

async function targetLabel(type: ReportRow["target_type"], id: string) {
  const admin = createAdminClient();
  if (type === "plan") {
    const { data } = await admin.from("plans").select("activity").eq("id", id).maybeSingle();
    return data?.activity ? `Plan: ${data.activity}` : `Plan ${id.slice(0, 8)}`;
  }
  if (type === "profile") {
    const { data } = await admin.from("profiles").select("first_name").eq("id", id).maybeSingle();
    return data?.first_name ? `Person: ${data.first_name}` : `Person ${id.slice(0, 8)}`;
  }
  return `Photo ${id.slice(0, 8)}`;
}

export async function listReports(): Promise<{ error: string | null; reports: ReportRow[] }> {
  if (!(await currentReportsAdmin())) return { error: "Not allowed.", reports: [] };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reports")
    .select("id, target_type, target_id, reason, status, created_at, reporter_id")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { error: error.message, reports: [] };

  const reporterIds = [...new Set((data ?? []).map((row) => row.reporter_id))];
  const { data: people } = reporterIds.length
    ? await admin.from("profiles").select("id, first_name").in("id", reporterIds)
    : { data: [] };
  const names = new Map((people ?? []).map((person) => [person.id, person.first_name]));

  const reports = await Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      target_type: row.target_type as ReportRow["target_type"],
      target_id: row.target_id,
      reason: row.reason,
      status: row.status as ReportRow["status"],
      created_at: row.created_at,
      reporter_name: names.get(row.reporter_id) ?? "Someone",
      target_label: await targetLabel(row.target_type as ReportRow["target_type"], row.target_id),
    })),
  );
  return { error: null, reports };
}

export async function setReportStatus(
  id: string,
  status: "actioned" | "dismissed",
): Promise<{ error: string | null }> {
  if (!(await currentReportsAdmin())) return { error: "Not allowed." };
  if (status !== "actioned" && status !== "dismissed") return { error: "Bad status." };
  const admin = createAdminClient();
  const { error } = await admin.from("reports").update({ status }).eq("id", id);
  if (error) return { error: "Couldn't update that report." };
  revalidatePath("/reports");
  return { error: null };
}
