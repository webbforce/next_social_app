import Link from "next/link";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    // The mark is already a rounded tile; a plain img keeps the spark crisp at small sizes.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="" width={size} height={size} className="shrink-0" />
  );
}

export function BrandLink() {
  return (
    <Link href="/" className="flex items-center gap-2 self-start">
      <BrandMark size={28} />
      <span className="font-display text-lg font-bold tracking-tight">upFor</span>
    </Link>
  );
}
