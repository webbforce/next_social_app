import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BrandLink } from "@/components/brand";
import { PrivacyLink } from "@/components/privacy-link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next: nextParam } = await props.searchParams;
  const next = safeNextPath(nextParam);

  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("first_name, is_18_plus_confirmed")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  if (user && !user.isAnonymous && profile?.is_18_plus_confirmed) redirect(next);

  const { data: campuses } = await supabase.from("campuses").select("id, name").order("name");

  return (
    <main className="flex flex-1 flex-col gap-6 py-12">
      <BrandLink />
      <LoginForm
        next={next}
        campuses={campuses ?? []}
        signedInAsHost={!!user && !user.isAnonymous}
        guestFirstName={profile?.first_name ?? ""}
      />
      <PrivacyLink />
    </main>
  );
}
