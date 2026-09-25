import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; isAnonymous: boolean };

// Guests are anonymous Supabase users; hosts have verified a phone number.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, isAnonymous: claims.is_anonymous === true };
}

// Only allow same-site relative redirects.
export function safeNextPath(value: unknown, fallback = "/") {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}
