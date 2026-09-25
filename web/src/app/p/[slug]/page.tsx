import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { BrandLink } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth";
import { isAutoEpisodeDue, renderEpisodeForPlan } from "@/lib/episode-render";
import { isPhotoWindowOpen } from "@/lib/moments";
import { getPlanBySlug, getPlanEpisode, getPlanMoments, getPlanUpdates, planHeadline } from "@/lib/plan";
import { MakeEpisodeButton } from "./episode/make-button";
import { StartPlanCta } from "./episode/start-plan-cta";
import { createClient } from "@/lib/supabase/server";
import { DeleteAccountButton } from "@/app/delete-account-button";
import { ReportControl } from "@/app/report/report-control";
import { PrivacyLink } from "@/components/privacy-link";
import { MomentsPanel } from "./moments-panel";
import { OpenTracker } from "./open-tracker";
import { PlanLive } from "./plan-live";

export async function generateMetadata(props: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const plan = await getPlanBySlug(slug);
  if (!plan) return { title: "Plan not found", robots: { index: false } };

  const headline = planHeadline(plan);
  return {
    title: headline,
    description: "Tap to say if you're in. No app needed.",
    robots: { index: false },
    openGraph: { title: headline, description: "Tap to say if you're in. No app needed." },
    twitter: { card: "summary_large_image" },
  };
}

export default async function PlanPage(props: PageProps<"/p/[slug]">) {
  const { slug } = await props.params;
  const { new: justCreated } = await props.searchParams;

  const plan = await getPlanBySlug(slug);
  if (!plan) notFound();

  const user = await getCurrentUser();
  const supabase = await createClient();

  const isMember = plan.is_host || plan.my_rsvp !== null;
  const isInsider = plan.is_host || plan.my_rsvp === "in" || plan.my_rsvp === "maybe";

  const [{ data: profile }, updates, moments, episode] = await Promise.all([
    user
      ? supabase.from("profiles").select("is_18_plus_confirmed").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    isMember ? getPlanUpdates(plan.id) : Promise.resolve(null),
    isInsider ? getPlanMoments(plan.id) : Promise.resolve([]),
    isInsider ? getPlanEpisode(plan.id) : Promise.resolve(null),
  ]);

  if (
    isAutoEpisodeDue(plan.ends_at, plan.status) &&
    moments.length > 0 &&
    episode?.status !== "ready" &&
    episode?.status !== "rendering"
  ) {
    after(() => renderEpisodeForPlan(slug, { actorUserId: null, replaceReady: false }));
  }

  const needsProfile = !profile?.is_18_plus_confirmed;

  return (
    <main className="flex flex-1 flex-col gap-5 py-6">
      <OpenTracker slug={slug} />
      <BrandLink />

      <PlanLive
        slug={slug}
        userId={user?.id ?? null}
        hasSession={!!user}
        needsProfile={needsProfile}
        justCreated={justCreated === "1"}
        initialPlan={plan}
        initialUpdates={updates}
      />

      {isInsider && user && (
        <MomentsPanel
          planId={plan.id}
          slug={slug}
          userId={user.id}
          isHost={plan.is_host}
          canUpload={isPhotoWindowOpen(plan.starts_at, plan.ends_at, plan.status)}
          initialMoments={moments.map((m) => ({
            ...m,
            uploaderName:
              m.uploaderId === plan.host.id
                ? plan.host.first_name
                : (plan.participants.find((p) => p.user_id === m.uploaderId)?.first_name ?? m.uploaderName),
          }))}
        />
      )}

      {isInsider && episode?.status === "ready" && (
        <Link href={`/p/${slug}/episode`} className="card flex flex-col gap-1 active:bg-stone-100">
          <span className="font-semibold">See the episode →</span>
          <span className="text-stone-600">The recap from this plan.</span>
        </Link>
      )}

      {isInsider && episode?.status === "rendering" && (
        <p className="card text-stone-600">Making the episode…</p>
      )}

      {plan.is_host && moments.length > 0 && episode?.status !== "ready" && (
        <MakeEpisodeButton slug={slug} label="Make episode now" />
      )}

      <ReportControl
        targetType="plan"
        targetId={plan.id}
        slug={slug}
        hasSession={!!user}
        label="Report this plan"
      />

      <PrivacyLink />
      {user && !plan.is_host && <DeleteAccountButton />}

      {!plan.is_host && (
        <StartPlanCta
          surface="post_plan"
          title={plan.status === "ended" ? "Doing something else this week?" : "Got your own idea?"}
          detail="Make a plan in 30 seconds →"
        />
      )}
    </main>
  );
}
