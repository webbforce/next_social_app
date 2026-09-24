import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth";
import { SignOutButton } from "@/app/sign-out-button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  const isHost = !!user && !user.isAnonymous;

  return (
    <main className="flex flex-1 flex-col justify-center gap-8 py-16">
      <BrandMark size={72} />
      <h1 className="text-4xl leading-tight font-bold tracking-tight">
        Make a plan in 30 seconds. Drop the link in your group chat.
      </h1>
      <p className="text-lg text-stone-600">
        Friends join from the link, no app or account needed. Afterwards, everyone&apos;s photos
        become one recap worth posting.
      </p>
      <div className="flex flex-col gap-3">
        <Link href="/new" className="btn-primary w-full">
          Make a plan
        </Link>
        {isHost && (
          <Link href="/free" className="btn-secondary w-full">
            Who&apos;s free
          </Link>
        )}
        {isHost && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <Link href="/reports" className="text-sm text-stone-500 underline">
              Reports
            </Link>
            <SignOutButton />
          </div>
        )}
      </div>
    </main>
  );
}
