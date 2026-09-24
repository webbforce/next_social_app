// Stage A runs on one campus, so all times are shown in its time zone, on the server and in link previews alike.
export const TIME_ZONE = "Europe/Amsterdam";

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const hourFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  hourCycle: "h23",
});
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const dayKey = (d: Date) => dayKeyFormat.format(d);
const DAY_MS = 24 * 60 * 60 * 1000;

export function formatTime(d: Date) {
  return timeFormat.format(d);
}

function dayLabel(d: Date, now: Date) {
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(new Date(now.getTime() + DAY_MS))) return "Tomorrow";
  return dateFormat.format(d);
}

// "tonight at 21:00", "today at 14:00", "tomorrow at 19:00", "Fri 26 Sep at 19:00"
export function whenPhrase(startsAt: Date, now = new Date()) {
  const time = formatTime(startsAt);
  const day = dayLabel(startsAt, now);
  if (day === "Today") {
    return Number(hourFormat.format(startsAt)) >= 17 ? `tonight at ${time}` : `today at ${time}`;
  }
  return `${day === "Tomorrow" ? "tomorrow" : day} at ${time}`;
}

// "Today, 19:00–21:00" or "Fri 26 Sep, 22:00 – Sat 27 Sep, 03:00"
export function formatDuration(startsAt: Date, endsAt: Date) {
  const minutes = Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

export function formatRange(startsAt: Date, endsAt: Date, now = new Date()) {
  const startDay = dayLabel(startsAt, now);
  if (dayKey(startsAt) === dayKey(endsAt)) {
    return `${startDay}, ${formatTime(startsAt)}–${formatTime(endsAt)}`;
  }
  return `${startDay}, ${formatTime(startsAt)} – ${dayLabel(endsAt, now)}, ${formatTime(endsAt)}`;
}

function tzOffsetMs(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return (
    Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - date.getTime()
  );
}

function wallTime(year: number, month: number, day: number, hour: number) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, 0, 0);
  return new Date(utcGuess - tzOffsetMs(new Date(utcGuess)));
}

// "I'm free tonight" lasts until 04:00 campus time — today if it's still before 04:00, otherwise tomorrow.
export function nextFourAm(now = new Date()) {
  const [year, month, day] = dayKey(now).split("-").map(Number);
  const todayAtFour = wallTime(year, month, day, 4);
  if (now.getTime() < todayAtFour.getTime()) return todayAtFour;
  const nextDay = amsterdamYmd(new Date(wallTime(year, month, day, 12).getTime() + DAY_MS));
  return wallTime(nextDay.year, nextDay.month, nextDay.day, 4);
}

function amsterdamYmd(d: Date) {
  const [year, month, day] = dayKey(d).split("-").map(Number);
  return { year, month, day };
}
