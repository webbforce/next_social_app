export function Avatar({
  name,
  src,
  size = "md",
}: {
  id: string;
  name: string;
  src?: string | null;
  size?: "md" | "lg";
}) {
  const dims = size === "lg" ? "size-14 text-xl" : "size-9 text-sm";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden
        className={`inline-block shrink-0 rounded-full object-cover ${size === "lg" ? "size-14" : "size-9"}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-paper ${dims}`}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
