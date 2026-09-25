import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLink } from "@/components/brand";
import { PrivacyLink } from "@/components/privacy-link";
import { ReportControl } from "@/app/report/report-control";
import { StartPlanCta } from "@/app/p/[slug]/episode/start-plan-cta";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicEpisodeTracker } from "./open-tracker";

export async function generateMetadata(props: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const episode = await getPublicEpisode(slug);
  if (!episode) return { title: "Episode not found" };
  return {
    title: `Up for ${episode.activity}`,
    description: "A recap made with upFor.",
    openGraph: { title: `Up for ${episode.activity}`, description: "A recap made with upFor." },
  };
}

async function getPublicEpisode(slug: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_public_episode", { p_slug: slug });
  if (error || !data) return null;
  const episode = data as {
    id: string;
    activity: string;
    card_path: string | null;
    highlights: { people?: number; photos?: number; duration?: string; place?: string | null };
  };
  const { data: row } = await admin.from("episodes").select("plan_id").eq("id", episode.id).maybeSingle();
  return { ...episode, plan_id: (row?.plan_id as string | undefined) ?? null };
}

export default async function PublicEpisodePage(props: PageProps<"/e/[slug]">) {
  const { slug } = await props.params;
  const [episode, user] = await Promise.all([getPublicEpisode(slug), getCurrentUser()]);
  if (!episode) notFound();

  const admin = createAdminClient();
  const { data: signed } = episode.card_path
    ? await admin.storage.from("episodes").createSignedUrl(episode.card_path, 3600)
    : { data: null };

  return (
    <main className="flex flex-1 flex-col gap-6 py-10">
      <PublicEpisodeTracker slug={slug} />
      <BrandLink />
      <h1 className="text-4xl font-bold tracking-tight">Up for {episode.activity}</h1>
      {signed?.signedUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={signed.signedUrl} alt={`Episode of ${episode.activity}`} className="w-full rounded-3xl" />
      )}
      <StartPlanCta surface="public_episode" />
      {episode.plan_id && (
        <ReportControl
          targetType="plan"
          targetId={episode.plan_id}
          planId={episode.plan_id}
          hasSession={!!user}
          label="Report this plan"
        />
      )}
      <PrivacyLink />
    </main>
  );
}
