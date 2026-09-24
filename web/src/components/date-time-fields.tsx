"use client";

export function DateTimeFields({
  date,
  time,
  onDate,
  onTime,
}: {
  date: string;
  time: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-stone-500">Day</span>
        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => onDate(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-stone-500">Time</span>
        <input
          className="input"
          type="time"
          value={time}
          onChange={(e) => onTime(e.target.value)}
          required
        />
      </label>
    </div>
  );
}
