"use client";

import { useActionState, useState } from "react";
import { ACTIVITIES, FREE_TEXT_HOURS, type ActivityTag } from "@/lib/activities";
import { createPlan, type CreatePlanState } from "./actions";

type StartMode = "now" | "today" | "pick";

const DURATIONS = [1, 1.5, 2, 3, 4, 5, 6, 8];

function nextFullHour() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

function startFor(mode: StartMode, todayTime: string, picked: string) {
  if (mode === "now") return new Date();
  if (mode === "pick") return picked ? new Date(picked) : null;
  const [h, m] = todayTime.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
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
        selected ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white"
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
  const [picked, setPicked] = useState("");
  const [hours, setHours] = useState<number | null>(null);
  const [place, setPlace] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const selected = ACTIVITIES.find((a) => a.tag === tag);
  const activity = selected ? selected.phrase : customActivity.trim();
  const defaultHours = selected?.hours ?? FREE_TEXT_HOURS;
  const duration = hours ?? defaultHours;

  function submit(formData: FormData) {
    const start = startFor(startMode, todayTime, picked);
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
    formData.set("place", place.trim());
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
          <input
            className="input"
            type="datetime-local"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            required
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

      <label className="flex flex-col gap-3">
        <span className="text-sm font-medium">Where (optional)</span>
        <input
          className="input"
          placeholder="Café de Jaren, or paste a maps link"
          maxLength={500}
          value={place}
          onChange={(e) => setPlace(e.target.value)}
        />
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary" disabled={pending || !activity}>
        {pending ? "Creating…" : "Create plan"}
      </button>
    </form>
  );
}
