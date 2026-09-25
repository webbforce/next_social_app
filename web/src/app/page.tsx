import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth";
import { getMyPlans } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";
import { HostHome } from "@/app/host-home";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: profile } =
    user && !user.isAnonymous
      ? await supabase
          .from("profiles")
          .select("is_18_plus_confirmed")
          .eq("id", user.id)
          .maybeSingle()
      : { data: null };
  const isHost = !!user && !user.isAnonymous && !!profile?.is_18_plus_confirmed;
  const mine = user ? await getMyPlans(user.id) : [];
  const plans = mine.filter((plan) => plan.status !== "cancelled");
  const showPlans = isHost || plans.length > 0;

  if (!user || !showPlans) {
    return (
      <main className="flex flex-1 flex-col justify-center gap-8 py-16">
        <BrandMark size={72} />
        <h1 className="text-4xl leading-tight font-bold tracking-tight">
          Make a plan in 30 seconds. Drop the link in your group chat.
        </h1>
        <p className="text-lg text-stone-600">
          Friends join from the link, no app or account needed. Afterwards, everyone&apos;s photos
          become one recap worth posting.
        </p>
        <Link href="/new" className="btn-primary w-full">
          Make a plan
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <HostHome userId={user.id} isHost={isHost} plans={plans} offerOnboarding={isHost && mine.length === 0} />
    </main>
  );
}
