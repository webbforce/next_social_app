"use client";

import Link from "next/link";
import { recordStartOwnPlan } from "./actions";

export function StartPlanCta({ surface }: { surface: "episode" | "public_episode" }) {
  return (
    <Link
      href="/new"
      className="card flex flex-col gap-1 active:bg-stone-100"
      onClick={() => {
        void recordStartOwnPlan(surface);
      }}
    >
      <span className="font-semibold">Start your own plan →</span>
      <span className="text-stone-600">Make a plan with your friends in 30 seconds.</span>
    </Link>
  );
}
