"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLink } from "@/components/brand";
import { StatusPill } from "@/components/status-pill";
import { AccountSetup } from "@/app/account-setup";
import { DeleteAccountButton } from "@/app/delete-account-button";
import { PrivacyLink } from "@/components/privacy-link";
import { SignOutButton } from "@/app/sign-out-button";
import type { MyPlan } from "@/lib/plan-view";
import { formatRange } from "@/lib/time";

const STEPS = [
  {
    title: "Make a plan",
    body: "Pick what you're up for, when, and where. It takes about 30 seconds.",
  },
  {
    title: "Drop the link",
    body: "Send it to the group chat. Friends tap I'm in with a first name. No app and no account.",
  },
  {
    title: "Get the recap",
    body: "During the plan, everyone adds photos. Afterwards they become one episode you can post.",
  },
];

function storageKey(userId: string) {
  return `upfor.onboarding.${userId}`;
}

function Onboarding({ onFinish }: { onFinish: (action: "skip" | "start") => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <section className="flex flex-col gap-8">
      <div className="flex gap-2" aria-hidden>
        {STEPS.map((_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full ${index <= step ? "bg-ink" : "bg-stone-200"}`}
          />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-stone-500">
          {step + 1} of {STEPS.length}
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{current.title}</h1>
        <p className="text-lg text-stone-600">{current.body}</p>
      </div>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            if (last) onFinish("start");
            else setStep((value) => value + 1);
          }}
        >
          {last ? "Make a plan" : "Continue"}
        </button>
        {!last && (
          <button type="button" className="text-sm text-stone-500 underline" onClick={() => onFinish("skip")}>
            Skip
          </button>
        )}
      </div>
    </section>
  );
}

function whoLine(plan: MyPlan) {
  const bits = [plan.inCount === 1 ? "1 in" : `${plan.inCount} in`];
  bits.push(plan.role === "host" ? "Hosting" : plan.hostName);
  if (plan.rsvp === "maybe") bits.push("Maybe");
  if (plan.episodeReady) bits.push("Recap ready");
  return bits.join(" · ");
}

function PlanCard({ plan }: { plan: MyPlan }) {
  return (
    <Link
      href={`/p/${plan.slug}`}
      className="flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white active:bg-stone-100"
    >
      {plan.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={plan.coverUrl} alt="" className="aspect-[3/2] w-full object-cover" />
      )}
      <span className="flex flex-col gap-1 p-5">
        {plan.status === "happening" && <StatusPill status="happening" />}
        <span className="font-display text-3xl font-bold leading-tight">{plan.activity}</span>
        <span className="text-stone-600">{formatRange(new Date(plan.startsAt), new Date(plan.endsAt))}</span>
        {plan.place && <span className="text-stone-600">{plan.place}</span>}
        <span className="text-sm text-stone-500">{whoLine(plan)}</span>
      </span>
    </Link>
  );
}

function PlanGroup({ title, plans }: { title: string; plans: MyPlan[] }) {
  if (!plans.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-stone-500">{title}</h2>
      <ul className="flex flex-col gap-3">
        {plans.map((plan) => (
          <li key={plan.id}>
            <PlanCard plan={plan} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function byStart(a: MyPlan, b: MyPlan) {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

function byEndDesc(a: MyPlan, b: MyPlan) {
  return new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime();
}

export function HostHome({
  userId,
  isHost,
  plans,
  offerOnboarding,
  needsProfile = false,
  campuses = [],
  firstName = "",
}: {
  userId: string;
  isHost: boolean;
  plans: MyPlan[];
  offerOnboarding: boolean;
  needsProfile?: boolean;
  campuses?: { id: string; name: string }[];
  firstName?: string;
}) {
  const router = useRouter();
  const [profileReady, setProfileReady] = useState(!needsProfile);
  const [started, setStarted] = useState<boolean | null>(needsProfile ? false : offerOnboarding ? null : true);

  useEffect(() => {
    if (!offerOnboarding || needsProfile) return;
    setStarted(window.localStorage.getItem(storageKey(userId)) === "1");
  }, [offerOnboarding, needsProfile, userId]);

  function finish(action: "skip" | "start") {
    window.localStorage.setItem(storageKey(userId), "1");
    setStarted(true);
    if (action === "start") router.push("/new");
  }

  const happening = plans.filter((plan) => plan.status === "happening").sort(byStart);
  const upcoming = plans.filter((plan) => plan.status === "open").sort(byStart);
  const recent = plans.filter((plan) => plan.status === "ended").sort(byEndDesc);
  const hasPlans = happening.length + upcoming.length + recent.length > 0;

  return (
    <>
      <BrandLink />
      {!profileReady ? (
        <AccountSetup campuses={campuses} firstName={firstName} onDone={() => setProfileReady(true)} />
      ) : started !== true ? (
        started === null ? <div className="h-48" /> : <Onboarding onFinish={finish} />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">Your plans</h1>
            {!hasPlans && (
              <p className="text-lg text-stone-600">Nothing coming up. Make one and drop the link in the group chat.</p>
            )}
          </div>
          <Link href="/new" className="btn-primary w-full">
            Make a plan
          </Link>
          {hasPlans && (
            <div className="flex flex-col gap-6">
              <PlanGroup title="Happening now" plans={happening} />
              <PlanGroup title="Coming up" plans={upcoming} />
              <PlanGroup title="Recent" plans={recent} />
            </div>
          )}
          {isHost && (
            <Link href="/free" className="text-center text-sm font-medium text-stone-600 underline">
              Who&apos;s free
            </Link>
          )}
          <div className="mt-auto flex flex-col items-center gap-2 pt-4">
            {isHost && (
              <Link href="/reports" className="text-sm text-stone-500 underline">
                Reports
              </Link>
            )}
            <PrivacyLink />
            <SignOutButton />
            <DeleteAccountButton />
          </div>
        </>
      )}
    </>
  );
}
