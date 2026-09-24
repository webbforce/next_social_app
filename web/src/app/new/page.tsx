import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isActivityTag } from "@/lib/activities";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BrandLink } from "@/components/brand";
import { ProfilePhotoButton } from "@/app/profile-photo-button";
import { SignOutButton } from "@/app/sign-out-button";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Make a plan" };

export default async function NewPlanPage(props: PageProps<"/new">) {
  const { from, tag } = await props.searchParams;
  const user = await getCurrentUser();
  if (!user || user.isAnonymous) redirect("/login?next=/new");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_18_plus_confirmed, photo_path")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_18_plus_confirmed) redirect("/login?next=/new");

  const initialTag = isActivityTag(tag) ? tag : null;
  const source = from === "free" ? "free_page" : "web_create";

  return (
    <main className="flex flex-1 flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <BrandLink />
        <SignOutButton />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">What are you up for?</h1>
      <PlanForm initialTag={initialTag} source={source} />
      {profile && !profile.photo_path && <ProfilePhotoButton />}
      <Link href="/free" className="text-center text-sm font-medium text-stone-600 underline">
        Or say you&apos;re free tonight
      </Link>
    </main>
  );
}
