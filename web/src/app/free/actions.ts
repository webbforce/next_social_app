"use server";

import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { isFreeIntent, type FreeIntent } from "@/lib/free";
import { createClient } from "@/lib/supabase/server";
import { nextFourAm } from "@/lib/time";

type Result = { error: string | null };

async function requireHost() {
  const user = await getCurrentUser();
  if (!user || user.isAnonymous) return null;
  return user;
}

export async function setFree(intent: FreeIntent | null): Promise<Result> {
  const user = await requireHost();
  if (!user) return { error: "Sign in with your phone first." };
  if (intent !== null && !isFreeIntent(intent)) return { error: "Pick coffee, food, drinks or anything." };

  const supabase = await createClient();
  await supabase
    .from("free_signals")
    .update({ cleared_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("cleared_at", null);

  const { error } = await supabase.from("free_signals").insert({
    user_id: user.id,
    intent,
    expires_at: nextFourAm().toISOString(),
  });
  if (error) return { error: "Couldn't save that. Try again." };

  track("free_signal_set", user.id, { intent });
  revalidatePath("/free");
  return { error: null };
}

export async function clearFree(): Promise<Result> {
  const user = await requireHost();
  if (!user) return { error: "Sign in with your phone first." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("free_signals")
    .update({ cleared_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("cleared_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("intent");
  if (error) return { error: "Couldn't clear that. Try again." };

  track("free_signal_cleared", user.id, { intent: data?.[0]?.intent ?? null });
  revalidatePath("/free");
  return { error: null };
}

export async function recordFreePageViewed(freePeopleVisible: number) {
  const user = await getCurrentUser();
  track("free_page_viewed", user?.id ?? null, { free_people_visible: freePeopleVisible });
}