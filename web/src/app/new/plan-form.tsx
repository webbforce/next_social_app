"use client";

import { useActionState, useState } from "react";
import { PlaceField } from "@/components/place-field";
import { DateTimeFields } from "@/components/date-time-fields";
import { ACTIVITIES, FREE_TEXT_HOURS, type ActivityTag } from "@/lib/activities";
import type { PlaceDraft } from "@/lib/place";
import { fromDateAndTime, toDateInputValue } from "@/lib/time";
import { createPlan, type CreatePlanState } from "./actions";

type StartMode = "now" | "today" | "pick";

const DURATIONS = [1, 1.5, 2, 3, 4, 5, 6, 8];

function nextFullHour() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

function startFor(mode: StartMode, todayTime: string, pickedDate: string, pickedTime: string) {
  if (mode === "now") return new Date();
  if (mode === "pick") return fromDateAndTime(pickedDate, pickedTime);
  const [h, m] = todayTime.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function tomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateInputValue(d);
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`h-10 rounded-full border px-4 text-sm font-medium ${
        selected ? "border-ink bg-ink text-paper" : "border-stone-300 bg-white"
      }`}
    >
      {children}
    </button>
  );
}

export function PlanForm({
  initialTag = null,
  source = "web_create",
}: {
  initialTag?: ActivityTag | null;
  source?: "web_create" | "free_page";
}) {
  const [state, dispatch, pending] = useActionState<CreatePlanState, FormData>(createPlan, {
    error: null,
  });
  const [tag, setTag] = useState<ActivityTag | null>(initialTag);
  const [customActivity, setCustomActivity] = useState("");
  const [startMode, setStartMode] = useState<StartMode>("now");
  const [todayTime, setTodayTime] = useState(nextFullHour);
  const [pickedDate, setPickedDate] = useState(tomorrowDate);
  const [pickedTime, setPickedTime] = useState(nextFullHour);
  const [hours, setHours] = useState<number | null>(null);
  const [place, setPlace] = useState<PlaceDraft>({ text: "", lat: null, lng: null });
  const [localError, setLocalError] = useState<string | null>(null);

  const selected = ACTIVITIES.find((a) => a.tag === tag);
  const activity = selected ? selected.phrase : customActivity.trim();
  const defaultHours = selected?.hours ?? FREE_TEXT_HOURS;
  const duration = hours ?? defaultHours;

  function submit(formData: FormData) {
    const start = startFor(startMode, todayTime, pickedDate, pickedTime);
    if (!activity) return setLocalError("Pick an activity or type your own.");
    if (!start || Number.isNaN(start.getTime())) return setLocalError("Pick a start time.");
    if (startMode !== "now" && start.getTime() < Date.now() - 5 * 60 * 1000) {
      return setLocalError("That time has already passed today. Pick a later one.");
    }
    setLocalError(null);

    formData.set("activity", activity);
    formData.set("activity_tag", tag ?? "");
    formData.set("starts_at", start.toISOString());
    formData.set("ends_at", new Date(start.getTime() + duration * 3_600_000).toISOString());
    formData.set("place", place.text.trim());
    formData.set("place_lat", place.lat == null ? "" : String(place.lat));
    formData.set("place_lng", place.lng == null ? "" : String(place.lng));
    formData.set("source", source);
    dispatch(formData);
  }

  const error = localError ?? state.error;

  return (
    <form action={submit} className="flex flex-col gap-7">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">Activity</legend>
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.map((a) => (
            <Chip
              key={a.tag}
              selected={tag === a.tag}
              onClick={() => {
                setTag(tag === a.tag ? null : a.tag);
                setHours(null);
              }}
            >
              {a.label}
            </Chip>
          ))}
        </div>
        <input
          className="input"
          placeholder="Or type your own, e.g. bouldering"
          maxLength={80}
          value={customActivity}
          onChange={(e) => {
            setCustomActivity(e.target.value);
            if (e.target.value) setTag(null);
          }}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">When</legend>
        <div className="flex flex-wrap gap-2">
          <Chip selected={startMode === "now"} onClick={() => setStartMode("now")}>
            Now
          </Chip>
          <Chip selected={startMode === "today"} onClick={() => setStartMode("today")}>
            Today at…
          </Chip>
          <Chip selected={startMode === "pick"} onClick={() => setStartMode("pick")}>
            Pick a day
          </Chip>
        </div>
        {startMode === "today" && (
          <input
            className="input"
            type="time"
            value={todayTime}
            onChange={(e) => setTodayTime(e.target.value)}
            required
          />
        )}
        {startMode === "pick" && (
          <DateTimeFields
            date={pickedDate}
            time={pickedTime}
            onDate={setPickedDate}
            onTime={setPickedTime}
          />
        )}
        <label className="flex items-center justify-between gap-3 text-sm text-stone-600">
          <span>Lasts about</span>
          <select
            className="h-10 rounded-full border border-stone-300 bg-white px-3 text-sm text-stone-900"
            value={duration}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            {DURATIONS.map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <PlaceField value={place} onChange={setPlace} />

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary" disabled={pending || !activity}>
        {pending ? "Creating…" : "Create plan"}
      </button>
    </form>
  );
}
