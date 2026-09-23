import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Make a plan" };

export default async function NewPlanPage() {
  const user = await getCurrentUser();
  if (!user || user.isAnonymous) redirect("/login?next=/new");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_18_plus_confirmed")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_18_plus_confirmed) redirect("/login?next=/new");

  return (
    <main className="flex flex-1 flex-col gap-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">What are you up for?</h1>
      <PlanForm />
    </main>
  );
}
