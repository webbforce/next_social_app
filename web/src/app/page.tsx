import { getCurrentUser } from "@/lib/auth";
import { getMyPlans } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";
import { HostHome } from "@/app/host-home";
import { Splash } from "@/app/splash";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: profile } =
    user && !user.isAnonymous
      ? await supabase
          .from("profiles")
          .select("is_18_plus_confirmed, first_name")
          .eq("id", user.id)
          .maybeSingle()
      : { data: null };
  const phoneVerified = !!user && !user.isAnonymous;
  const isHost = phoneVerified && !!profile?.is_18_plus_confirmed;
  const mine = user ? await getMyPlans(user.id) : [];
  const plans = mine.filter((plan) => plan.status !== "cancelled");
  const needsProfile = phoneVerified && !isHost && plans.length === 0;

  if (!user || (user.isAnonymous && plans.length === 0)) {
    return <Splash />;
  }

  const { data: campuses } = needsProfile
    ? await supabase.from("campuses").select("id, name").order("name")
    : { data: [] };

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <HostHome
        userId={user.id}
        isHost={isHost}
        plans={plans}
        offerOnboarding={isHost && mine.length === 0}
        needsProfile={needsProfile}
        campuses={campuses ?? []}
        firstName={profile?.first_name ?? ""}
        unsavedAccount={!!user.isAnonymous}
      />
    </main>
  );
}
