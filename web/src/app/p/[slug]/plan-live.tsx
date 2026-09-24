"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { ReportControl } from "@/app/report/report-control";
import { planHeadline, type PlanStatus, type PlanUpdate, type PlanView } from "@/lib/plan-view";
import { formatRange, formatTime } from "@/lib/time";
import { refreshPlanSnapshot } from "./actions";
import { LeavePlanButton } from "./leave-plan";
import { HostTools, RemoveButton } from "./host-tools";
import { RsvpPanel } from "./rsvp-panel";
import { SharePanel } from "./share-panel";
import { UpdateForm } from "./update-form";

const STATUS_LABEL: Record<PlanStatus, string | null> = {
  open: null,
  happening: "Happening now",
  ended: "Ended",
  cancelled: "Cancelled",
};

const POLL_MS = 4000;

export function PlanLive({
  slug,
  userId,
  hasSession,
  needsProfile,
  justCreated,
  initialPlan,
  initialUpdates,
}: {
  slug: string;
  userId: string | null;
  hasSession: boolean;
  needsProfile: boolean;
  justCreated: boolean;
  initialPlan: PlanView;
  initialUpdates: PlanUpdate[] | null;
}) {
  const [plan, setPlan] = useState(initialPlan);
  const [updates, setUpdates] = useState(initialUpdates);

  useEffect(() => {
    setPlan(initialPlan);
    setUpdates(initialUpdates);
  }, [initialPlan, initialUpdates]);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const snap = await refreshPlanSnapshot(slug);
      if (cancelled || !snap) return;
      setPlan(snap.plan);
      if (snap.updates) setUpdates(snap.updates);
    }
    const timer = window.setInterval(() => void tick(), POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [slug]);

  const isLive = plan.status === "open" || plan.status === "happening";
  const isMember = plan.is_host || plan.my_rsvp !== null;
  const isInsider = plan.is_host || plan.my_rsvp === "in" || plan.my_rsvp === "maybe";
  const going = plan.participants.filter((p) => p.rsvp === "in");
  const maybe = plan.participants.filter((p) => p.rsvp === "maybe");
  const reclaimableGuests = plan.reclaimable_guests ?? [];
  const canReclaim = !plan.my_rsvp && needsProfile && reclaimableGuests.length > 0;
  const statusLabel = STATUS_LABEL[plan.status];
  const headline = planHeadline(plan);

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar id={plan.host.id} name={plan.host.first_name} src={plan.host.photo_url} size="lg" />
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
        <SharePanel planId={plan.id} slug={slug} headline={headline} highlight={justCreated} />
      )}

      {plan.am_removed && <p className="card text-stone-600">The host removed you from this plan.</p>}

      {!plan.is_host && !plan.am_removed && (isLive || canReclaim) && (
        <RsvpPanel
          slug={slug}
          current={plan.my_rsvp}
          hasSession={hasSession}
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
            <Avatar id={plan.host.id} name={plan.host.first_name} src={plan.host.photo_url} />
            <span className="flex-1">{plan.host.first_name}</span>
            <span className="text-sm text-stone-500">Host</span>
            {userId !== plan.host.id && (
              <ReportControl
                targetType="profile"
                targetId={plan.host.id}
                slug={slug}
                hasSession={hasSession}
              />
            )}
          </li>
          {going.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <Avatar id={p.user_id} name={p.first_name} src={p.photo_url} />
              <span className="flex-1">{p.first_name}</span>
              {plan.is_host && <RemoveButton participantId={p.id} name={p.first_name} slug={slug} />}
              {userId !== p.user_id && (
                <ReportControl
                  targetType="profile"
                  targetId={p.user_id}
                  slug={slug}
                  hasSession={hasSession}
                />
              )}
            </li>
          ))}
        </ul>
        {maybe.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-stone-500">Maybe</h3>
            <ul className="flex flex-col gap-3">
              {maybe.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <Avatar id={p.user_id} name={p.first_name} src={p.photo_url} />
                  <span className="flex-1">{p.first_name}</span>
                  {plan.is_host && <RemoveButton participantId={p.id} name={p.first_name} slug={slug} />}
                  {userId !== p.user_id && (
                    <ReportControl
                      targetType="profile"
                      targetId={p.user_id}
                      slug={slug}
                      hasSession={hasSession}
                    />
                  )}
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

      {plan.is_host && isLive && <HostTools plan={plan} slug={slug} />}

      {isMember && !plan.is_host && !plan.am_removed && <LeavePlanButton slug={slug} />}
    </>
  );
}
