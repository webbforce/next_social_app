import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { BrandLink } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth";
import { isAutoEpisodeDue, renderEpisodeForPlan } from "@/lib/episode-render";
import { isPhotoWindowOpen } from "@/lib/moments";
import { getPlanBySlug, getPlanEpisode, getPlanMoments, planHeadline, type PlanStatus } from "@/lib/plan";
import { MakeEpisodeButton } from "./episode/make-button";
import { createClient } from "@/lib/supabase/server";
import { formatRange, formatTime } from "@/lib/time";
import { HostTools, RemoveButton } from "./host-tools";
import { MomentsPanel } from "./moments-panel";
import { OpenTracker } from "./open-tracker";
import { RsvpPanel } from "./rsvp-panel";
import { SharePanel } from "./share-panel";
import { UpdateForm } from "./update-form";

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

const STATUS_LABEL: Record<PlanStatus, string | null> = {
  open: null,
  happening: "Happening now",
  ended: "Ended",
  cancelled: "Cancelled",
};

type Update = { id: string; body: string; created_at: string; author: { id: string; first_name: string } | null };

export default async function PlanPage(props: PageProps<"/p/[slug]">) {
  const { slug } = await props.params;
  const { new: justCreated } = await props.searchParams;

  const plan = await getPlanBySlug(slug);
  if (!plan) notFound();

  const user = await getCurrentUser();
  const supabase = await createClient();

  const isMember = plan.is_host || plan.my_rsvp !== null;
  const isInsider = plan.is_host || plan.my_rsvp === "in" || plan.my_rsvp === "maybe";
  const isLive = plan.status === "open" || plan.status === "happening";

  const [{ data: profile }, { data: updates }, moments, episode] = await Promise.all([
    user
      ? supabase.from("profiles").select("is_18_plus_confirmed").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    isMember
      ? supabase
          .from("plan_updates")
          .select("id, body, created_at, author:profiles(id, first_name)")
          .eq("plan_id", plan.id)
          .order("created_at")
          .returns<Update[]>()
      : Promise.resolve({ data: null }),
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

  const going = plan.participants.filter((p) => p.rsvp === "in");
  const maybe = plan.participants.filter((p) => p.rsvp === "maybe");
  const reclaimableGuests = plan.reclaimable_guests ?? [];
  const needsProfile = !profile?.is_18_plus_confirmed;
  const canReclaim = !plan.my_rsvp && needsProfile && reclaimableGuests.length > 0;
  const statusLabel = STATUS_LABEL[plan.status];
  const headline = planHeadline(plan);

  return (
    <main className="flex flex-1 flex-col gap-5 py-6">
      <OpenTracker slug={slug} />
      <BrandLink />

      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar id={plan.host.id} name={plan.host.first_name} size="lg" />
          <p className="text-stone-600">
            <span className="font-semibold text-stone-900">{plan.host.first_name}</span>{" "}
            {plan.status === "ended" ? "was up for" : "is up for"}
          </p>
        </div>
        <h1
          className={`text-4xl leading-tight font-bold tracking-tight ${plan.status === "cancelled" ? "line-through decoration-2" : ""}`}
        >
          {plan.activity}
        </h1>
        <div className="flex flex-col gap-1 text-lg">
          <p>{formatRange(new Date(plan.starts_at), new Date(plan.ends_at))}</p>
          {plan.place_text && <p className="text-stone-600">{plan.place_text}</p>}
          {plan.place_url && (
            <a href={plan.place_url} target="_blank" rel="noopener noreferrer" className="text-stone-600 underline">
              Open the location
            </a>
          )}
        </div>
        {statusLabel && (
          <p
            className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${
              plan.status === "happening" ? "bg-lime-200 text-lime-900" : "bg-stone-200 text-stone-700"
            }`}
          >
            {statusLabel}
          </p>
        )}
      </header>

      {plan.is_host && isLive && (
        <SharePanel planId={plan.id} slug={slug} headline={headline} highlight={justCreated === "1"} />
      )}

      {plan.am_removed && (
        <p className="card text-stone-600">The host removed you from this plan.</p>
      )}

      {!plan.is_host && !plan.am_removed && (isLive || canReclaim) && (
        <RsvpPanel
          slug={slug}
          current={plan.my_rsvp}
          hasSession={!!user}
          needsProfile={needsProfile}
          reclaimableGuests={reclaimableGuests}
          allowNewRsvp={isLive}
        />
      )}

      <section className="card flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          {plan.in_count} {plan.in_count === 1 ? "person" : "people"} in
        </h2>
        <ul className="flex flex-col gap-3">
          <li className="flex items-center gap-3">
            <Avatar id={plan.host.id} name={plan.host.first_name} />
            <span className="flex-1">{plan.host.first_name}</span>
            <span className="text-sm text-stone-500">Host</span>
          </li>
          {going.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <Avatar id={p.user_id} name={p.first_name} />
              <span className="flex-1">{p.first_name}</span>
              {plan.is_host && <RemoveButton participantId={p.id} name={p.first_name} slug={slug} />}
            </li>
          ))}
        </ul>
        {maybe.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-stone-500">Maybe</h3>
            <ul className="flex flex-col gap-3">
              {maybe.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <Avatar id={p.user_id} name={p.first_name} />
                  <span className="flex-1">{p.first_name}</span>
                  {plan.is_host && <RemoveButton participantId={p.id} name={p.first_name} slug={slug} />}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {isMember && (
        <section className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Updates</h2>
          {updates?.length ? (
            <ul className="flex flex-col gap-3">
              {updates.map((u) => (
                <li key={u.id} className="flex flex-col">
                  <span className="text-sm text-stone-500">
                    {u.author?.first_name ?? "Someone"} · {formatTime(new Date(u.created_at))}
                  </span>
                  <span>{u.body}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">No updates yet.</p>
          )}
          {isInsider && plan.status !== "cancelled" && <UpdateForm planId={plan.id} slug={slug} />}
        </section>
      )}

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

      {plan.is_host && isLive && <HostTools planId={plan.id} slug={slug} canCancel />}

      {!plan.is_host && (
        <Link href="/new" className="card flex flex-col gap-1 active:bg-stone-100">
          <span className="font-semibold">
            {plan.status === "ended" ? "Doing something else this week?" : "Got your own idea?"}
          </span>
          <span className="text-stone-600">Make a plan in 30 seconds →</span>
        </Link>
      )}
    </main>
  );
}
