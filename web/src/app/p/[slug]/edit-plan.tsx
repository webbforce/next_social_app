"use client";

import { useState, useTransition } from "react";
import { DateTimeFields } from "@/components/date-time-fields";
import { PlaceField } from "@/components/place-field";
import { pinFromUrl, type PlaceDraft } from "@/lib/place";
import type { PlanView } from "@/lib/plan-view";
import { fromDateAndTime, toDateInputValue, toTimeInputValue } from "@/lib/time";
import { updatePlan } from "./actions";

const DURATIONS = [1, 1.5, 2, 3, 4, 5, 6, 8];

function draftFromPlan(plan: PlanView): PlaceDraft {
  const pin = plan.place_text ? pinFromUrl(plan.place_url) : null;
  if (pin) return { text: plan.place_text ?? "", lat: pin.lat, lng: pin.lng };
  return { text: plan.place_url ?? plan.place_text ?? "", lat: null, lng: null };
}

function hoursBetween(startsAt: string, endsAt: string) {
  return Math.round(((Date.parse(endsAt) - Date.parse(startsAt)) / 3_600_000) * 2) / 2;
}

export function EditPlanForm({
  plan,
  slug,
  onSaved,
}: {
  plan: PlanView;
  slug: string;
  onSaved: () => void;
}) {
  const currentHours = hoursBetween(plan.starts_at, plan.ends_at);
  const options = DURATIONS.includes(currentHours)
    ? DURATIONS
    : [...DURATIONS, currentHours].sort((a, b) => a - b);

  const start = new Date(plan.starts_at);
  const [date, setDate] = useState(() => toDateInputValue(start));
  const [time, setTime] = useState(() => toTimeInputValue(start));
  const [hours, setHours] = useState(currentHours);
  const [place, setPlace] = useState(() => draftFromPlan(plan));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const start = fromDateAndTime(date, time);
    if (!start) return setError("Pick a start time.");
    setError(null);
    const data = new FormData();
    data.set("starts_at", start.toISOString());
    data.set("ends_at", new Date(start.getTime() + hours * 3_600_000).toISOString());
    data.set("place", place.text.trim());
    data.set("place_lat", place.lat == null ? "" : String(place.lat));
    data.set("place_lng", place.lng == null ? "" : String(place.lng));
    startTransition(async () => {
      const result = await updatePlan(plan.id, slug, data);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Time and place</h2>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Starts</span>
        <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm text-stone-600">
        <span>Lasts about</span>
        <select
          className="h-10 rounded-full border border-stone-300 bg-white px-3 text-sm text-stone-900"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        >
          {options.map((h) => (
            <option key={h} value={h}>
              {h} h
            </option>
          ))}
        </select>
      </label>
      <PlaceField value={place} onChange={setPlace} />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
