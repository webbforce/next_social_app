import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-8 py-16">
      <p className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Upfor</p>
      <h1 className="text-4xl leading-tight font-bold tracking-tight">
        Make a plan in 30 seconds. Drop the link in your group chat.
      </h1>
      <p className="text-lg text-stone-600">
        Friends join from the link, no app or account needed. Afterwards, everyone&apos;s photos
        become one recap worth posting.
      </p>
      <Link href="/new" className="btn-primary w-full">
        Make a plan
      </Link>
    </main>
  );
}
