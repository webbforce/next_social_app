"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProfilePhotoButton } from "@/app/profile-photo-button";
import { PlanForm } from "./plan-form";

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

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <section className="flex flex-col gap-8">
      <div className="flex gap-2" aria-hidden>
        {STEPS.map((_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full ${index <= step ? "bg-stone-900" : "bg-stone-200"}`}
          />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-stone-500">
          {step + 1} of {STEPS.length}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{current.title}</h1>
        <p className="text-lg text-stone-600">{current.body}</p>
      </div>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            if (last) onDone();
            else setStep((value) => value + 1);
          }}
        >
          {last ? "Make a plan" : "Continue"}
        </button>
        {!last && (
          <button type="button" className="text-sm text-stone-500 underline" onClick={onDone}>
            Skip
          </button>
        )}
      </div>
    </section>
  );
}

export function FirstRun({
  userId,
  initialTag,
  source,
  showPhoto,
}: {
  userId: string;
  initialTag: Parameters<typeof PlanForm>[0]["initialTag"];
  source: Parameters<typeof PlanForm>[0]["source"];
  showPhoto: boolean;
}) {
  const [started, setStarted] = useState<boolean | null>(null);

  useEffect(() => {
    setStarted(window.localStorage.getItem(storageKey(userId)) === "1");
  }, [userId]);

  function finish() {
    window.localStorage.setItem(storageKey(userId), "1");
    setStarted(true);
  }

  if (started !== true) {
    return started === null ? <div className="h-48" /> : <Onboarding onDone={finish} />;
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">What are you up for?</h1>
      <PlanForm initialTag={initialTag} source={source} />
      {showPhoto && <ProfilePhotoButton />}
      <Link href="/free" className="text-center text-sm font-medium text-stone-600 underline">
        Or say you&apos;re free tonight
      </Link>
    </>
  );
}
