import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLink } from "@/components/brand";
import { StartPlanCta } from "@/app/p/[slug]/episode/start-plan-cta";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicEpisodeTracker } from "./open-tracker";

export async function generateMetadata(props: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const episode = await getPublicEpisode(slug);
  if (!episode) return { title: "Episode not found" };
  return {
    title: `Up for ${episode.activity}`,
    description: "A recap made with Upfor.",
    openGraph: { title: `Up for ${episode.activity}`, description: "A recap made with Upfor." },
  };
}

async function getPublicEpisode(slug: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_public_episode", { p_slug: slug });
  if (error || !data) return null;
  return data as {
    id: string;
    activity: string;
    card_path: string | null;
    highlights: { people?: number; photos?: number; duration?: string; place?: string | null };
  };
}

export default async function PublicEpisodePage(props: PageProps<"/e/[slug]">) {
  const { slug } = await props.params;
  const episode = await getPublicEpisode(slug);
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
    </main>
  );
}
