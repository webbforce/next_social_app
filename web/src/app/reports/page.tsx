import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLink } from "@/components/brand";
import { SignOutButton } from "@/app/sign-out-button";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClaimReportsForm } from "./claim-form";
import { ReportsInbox } from "./inbox";
import { currentReportsAdmin, listReports } from "./actions";

export const metadata: Metadata = { title: "Reports", robots: { index: false } };

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user || user.isAnonymous) redirect("/login?next=/reports");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_18_plus_confirmed")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_18_plus_confirmed) redirect("/login?next=/reports");

  const isAdmin = await currentReportsAdmin();
  const listed = isAdmin ? await listReports() : { error: null, reports: [] };

  return (
    <main className="relative left-1/2 flex w-screen -translate-x-1/2 flex-col gap-6 px-4 py-6 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <BrandLink />
          <SignOutButton />
        </div>
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-stone-600">Notes about a plan, a photo, or a person.</p>
        </header>
        {isAdmin ? (
          listed.error ? <p className="text-sm text-red-700">{listed.error}</p> : <ReportsInbox reports={listed.reports} />
        ) : (
          <div className="mx-auto w-full max-w-md">
            <ClaimReportsForm />
          </div>
        )}
      </div>
    </main>
  );
}
