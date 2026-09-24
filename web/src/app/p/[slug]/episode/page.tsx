import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrandLink } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth";
import { REEL_PHOTO_MIN, statsLine } from "@/lib/episode";
import { getPlanBySlug, getPlanEpisode, getPlanMoments } from "@/lib/plan";
import { siteLabel } from "@/lib/site";
import { defaultTrack, isTrackId } from "@/lib/tracks";
import { createClient } from "@/lib/supabase/server";
import { ReportControl } from "@/app/report/report-control";
import { ExcludeGrid } from "./exclude-grid";
import { MakeEpisodeButton } from "./make-button";
import { ReelPlayer } from "./reel-player";
import { ShareEpisode } from "./share-episode";
import { TrackPicker } from "./track-picker";
import { StartPlanCta } from "./start-plan-cta";
import { EpisodeViewTracker } from "./view-tracker";

export async function generateMetadata(props: PageProps<"/p/[slug]/episode">): Promise<Metadata> {
  const { slug } = await props.params;
  const plan = await getPlanBySlug(slug);
  if (!plan) return { title: "Episode not found" };
  return { title: `${plan.host.first_name} was up for ${plan.activity}`, robots: { index: false } };
}

export default async function EpisodePage(props: PageProps<"/p/[slug]/episode">) {
  const { slug } = await props.params;
  const plan = await getPlanBySlug(slug);
  if (!plan) notFound();

  const user = await getCurrentUser();
  const isInsider = plan.is_host || plan.my_rsvp === "in" || plan.my_rsvp === "maybe";
  if (!user || !isInsider) redirect(`/p/${slug}`);

  const supabase = await createClient();
  const [episode, moments] = await Promise.all([getPlanEpisode(plan.id), getPlanMoments(plan.id)]);

  const [{ data: myExclusions }, { data: allExclusions }] = await Promise.all([
    supabase.from("moment_exclusions").select("moment_id").eq("user_id", user.id),
    moments.length
      ? supabase
          .from("moment_exclusions")
          .select("moment_id")
          .in(
            "moment_id",
            moments.map((m) => m.id),
          )
      : Promise.resolve({ data: [] }),
  ]);

  const namedMoments = moments.map((m) => ({
    ...m,
    uploaderName:
      m.uploaderId === plan.host.id
        ? plan.host.first_name
        : (plan.participants.find((p) => p.user_id === m.uploaderId)?.first_name ?? m.uploaderName),
  }));

  const excludedAny = new Set((allExclusions ?? []).map((e) => e.moment_id));
  const usableCount = moments.filter((m) => !excludedAny.has(m.id)).length;
  const stale = episode?.status === "ready" && episode.highlights.photos !== usableCount;

  const [{ data: signed }, { data: signedVideo }] = await Promise.all([
    episode?.card_path && episode.status === "ready"
      ? supabase.storage.from("episodes").createSignedUrl(episode.card_path, 3600)
      : Promise.resolve({ data: null }),
    episode?.video_path && episode.status === "ready"
      ? supabase.storage.from("episodes").createSignedUrl(episode.video_path, 3600)
      : Promise.resolve({ data: null }),
  ]);

  const headline = `${plan.host.first_name} was up for ${plan.activity}`;
  const reelSlides =
    episode?.format === "reel"
      ? (episode.highlights.clips ?? [])
          .map((clip) => {
            const moment = namedMoments.find((m) => m.id === clip.id && !excludedAny.has(m.id));
            return moment?.url ? { url: moment.url, ms: clip.ms } : null;
          })
          .filter((slide): slide is { url: string; ms: number } => !!slide)
      : [];
  const showReel = reelSlides.length >= REEL_PHOTO_MIN;
  const trackId = isTrackId(episode?.music_track) ? episode.music_track : defaultTrack(episode?.template ?? "");

  return (
    <main className="flex flex-1 flex-col gap-5 py-6">
      {episode?.status === "ready" && <EpisodeViewTracker episodeId={episode.id} />}
      <BrandLink />
      <Link href={`/p/${slug}`} className="text-sm text-stone-600 underline">
        Back to the plan
      </Link>

      <header className="flex flex-col gap-2">
        <p className="text-stone-600">{plan.host.first_name} was up for</p>
        <h1 className="text-4xl font-bold tracking-tight">{plan.activity}</h1>
        {episode?.status === "ready" && <p className="text-stone-600">{statsLine(episode.highlights)}</p>}
      </header>

      {episode?.status === "ready" && showReel && (
        <>
          <ReelPlayer
            slides={reelSlides}
            hostName={plan.host.first_name}
            activity={plan.activity}
            trackId={trackId}
            link={siteLabel()}
          />
          <TrackPicker slug={slug} episodeId={episode.id} current={trackId} />
        </>
      )}

      {episode?.status === "ready" && signed?.signedUrl && !showReel && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={signed.signedUrl}
          alt={headline}
          className="w-full rounded-3xl border border-stone-200"
        />
      )}

      {episode?.status === "failed" && (
        <p className="card text-red-700">The last episode didn&apos;t finish. Try making it again.</p>
      )}

      {episode?.status === "rendering" && <p className="card text-stone-600">Making the episode…</p>}

      {!episode && moments.length === 0 && (
        <p className="card text-stone-600">Add photos on the plan page, then come back to make the episode.</p>
      )}

      {stale && <p className="text-sm text-stone-600">Photos changed. The host can update the episode.</p>}

      {plan.is_host && usableCount > 0 && (
        <MakeEpisodeButton
          slug={slug}
          label={episode?.status === "ready" ? "Update episode" : "Make episode now"}
        />
      )}

      {!plan.is_host && episode?.status !== "ready" && (
        <p className="text-sm text-stone-600">The host hasn&apos;t made the episode yet.</p>
      )}

      {episode?.status === "ready" && signed?.signedUrl && (
        <ShareEpisode
          episodeId={episode.id}
          slug={slug}
          cardUrl={signed.signedUrl}
          headline={headline}
          publicSlug={episode.public_share_slug}
          reel={
            showReel
              ? { slides: reelSlides, hostName: plan.host.first_name, activity: plan.activity, link: siteLabel() }
              : null
          }
          videoUrl={showReel ? (signedVideo?.signedUrl ?? null) : null}
        />
      )}

      {namedMoments.length > 0 && (
        <ExcludeGrid
          slug={slug}
          moments={namedMoments}
          excludedIds={(myExclusions ?? []).map((e) => e.moment_id)}
          userId={user.id}
        />
      )}

      <StartPlanCta surface="episode" />

      <ReportControl
        targetType="plan"
        targetId={plan.id}
        slug={slug}
        hasSession={!!user}
        label="Report this plan"
      />
    </main>
  );
}
