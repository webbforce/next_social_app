"use client";

import Link from "next/link";
import { recordStartOwnPlan } from "./actions";

const FROM = {
  episode: "episode",
  post_plan: "plan_page",
  public_episode: "public_episode",
} as const;

export function StartPlanCta({
  surface,
  title = "Start your own plan →",
  detail = "Make a plan with your friends in 30 seconds.",
}: {
  surface: "episode" | "post_plan" | "public_episode";
  title?: string;
  detail?: string;
}) {
  return (
    <Link
      href={`/new?from=${FROM[surface]}`}
      className="card flex flex-col gap-1 active:bg-stone-100"
      onClick={() => {
        void recordStartOwnPlan(surface);
      }}
    >
      <span className="font-semibold">{title}</span>
      <span className="text-stone-600">{detail}</span>
    </Link>
  );
}
