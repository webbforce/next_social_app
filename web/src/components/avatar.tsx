const COLORS = [
  "bg-rose-200 text-rose-900",
  "bg-amber-200 text-amber-900",
  "bg-lime-200 text-lime-900",
  "bg-sky-200 text-sky-900",
  "bg-violet-200 text-violet-900",
  "bg-teal-200 text-teal-900",
];

function colorFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({ id, name, size = "md" }: { id: string; name: string; size?: "md" | "lg" }) {
  const dims = size === "lg" ? "size-14 text-xl" : "size-9 text-sm";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dims} ${colorFor(id)}`}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
