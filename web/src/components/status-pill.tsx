import type { PlanStatus } from "@/lib/plan-view";

const LABEL = {
  happening: "Happening now",
  ended: "Ended",
  cancelled: "Cancelled",
} as const;

export function StatusPill({ status }: { status: PlanStatus }) {
  if (status === "open") return null;
  return (
    <span
      className={`w-fit shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
        status === "happening" ? "bg-up text-ink" : "bg-stone-200 text-stone-700"
      }`}
    >
      {LABEL[status]}
    </span>
  );
}
