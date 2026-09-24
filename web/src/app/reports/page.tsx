import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLink } from "@/components/brand";
import { SignOutButton } from "@/app/sign-out-button";
import { getCurrentUser } from "@/lib/auth";
import { ClaimReportsForm } from "./claim-form";
import { ReportsInbox } from "./inbox";
import { currentReportsAdmin, listReports } from "./actions";

export const metadata: Metadata = { title: "Reports", robots: { index: false } };

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user || user.isAnonymous) redirect("/login?next=/reports");

  const isAdmin = await currentReportsAdmin();
  const listed = isAdmin ? await listReports() : { error: null, reports: [] };

  return (
    <main className="flex flex-1 flex-col gap-5 py-6">
      <div className="flex items-center justify-between">
        <BrandLink />
        <SignOutButton />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
      {isAdmin ? (
        listed.error ? <p className="text-sm text-red-700">{listed.error}</p> : <ReportsInbox reports={listed.reports} />
      ) : (
        <ClaimReportsForm />
      )}
    </main>
  );
}
