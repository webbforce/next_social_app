import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { BrandLink } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth";
import { FREE_INTENT_LABEL, isFreeIntent, sharedFreeTag } from "@/lib/free";
import { createClient } from "@/lib/supabase/server";
import { FreeForm } from "./free-form";
import { OpenTracker } from "./open-tracker";

export const metadata: Metadata = { title: "Who's free" };

type SignalRow = { user_id: string; intent: string | null };
type ProfileRow = { id: string; first_name: string; photo_path: string | null };

export default async function FreePage() {
  const user = await getCurrentUser();
  if (!user || user.isAnonymous) redirect("/login?next=/free");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_18_plus_confirmed")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_18_plus_confirmed) redirect("/login?next=/free");

  const { data: signals } = await supabase
    .from("free_signals")
    .select("user_id, intent")
    .is("cleared_at", null)
    .gt("expires_at", new Date().toISOString())
    .returns<SignalRow[]>();

  const rows = signals ?? [];
  const ids = rows.map((row) => row.user_id);
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, first_name, photo_path").in("id", ids).returns<ProfileRow[]>()
    : { data: [] as ProfileRow[] };

  const names = new Map((people ?? []).map((p) => [p.id, p]));
  const mine = rows.find((row) => row.user_id === user.id);
  const others = rows
    .filter((row) => row.user_id !== user.id)
    .map((row) => ({
      id: row.user_id,
      first_name: names.get(row.user_id)?.first_name ?? "Someone",
      photo_path: names.get(row.user_id)?.photo_path ?? null,
      intent: isFreeIntent(row.intent) ? row.intent : null,
    }))
    .sort((a, b) => a.first_name.localeCompare(b.first_name));

  const mineIntent = mine ? (isFreeIntent(mine.intent) ? mine.intent : null) : undefined;
  const tag = sharedFreeTag([
    ...(mineIntent !== undefined ? [mineIntent] : []),
    ...others.map((p) => p.intent),
  ]);
  const planHref = `/new?from=free&tag=${tag}`;

  return (
    <main className="flex flex-1 flex-col gap-5 py-6">
      <OpenTracker freePeopleVisible={others.length} />
      <BrandLink />
      <h1 className="text-3xl font-bold tracking-tight">Who&apos;s free</h1>
      <FreeForm active={mineIntent} />

      <section className="card flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          {others.length === 0
            ? "Nobody else yet"
            : `${others.length} ${others.length === 1 ? "person" : "people"} free`}
        </h2>
        {others.length === 0 ? (
          <p className="text-sm text-stone-600">
            People you&apos;ve made a plan with in the last 30 days show up here when they tap I&apos;m free
            tonight.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {others.map((person) => (
              <li key={person.id} className="flex items-center gap-3">
                <Avatar id={person.id} name={person.first_name} />
                <span className="flex-1">{person.first_name}</span>
                <span className="text-sm text-stone-500">
                  {person.intent ? FREE_INTENT_LABEL[person.intent] : "Free"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href={planHref} className="btn-primary w-full">
        {others.length > 0 ? "Make a plan with them" : "Make a plan"}
      </Link>
    </main>
  );
}