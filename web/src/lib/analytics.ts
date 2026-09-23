import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Event names and properties follow docs/mvp-spec.md §7. Written after the response is sent.
export function track(name: string, userId: string | null, properties: Record<string, unknown> = {}) {
  after(async () => {
    const { error } = await createAdminClient()
      .from("analytics_events")
      .insert({ name, user_id: userId, properties });
    if (error) console.error(`analytics: failed to record ${name}: ${error.message}`);
  });
}

export function inAppBrowser(userAgent: string | null) {
  if (!userAgent) return null;
  const match = /(Instagram|FBAN|FBAV|WhatsApp|Snapchat|musical_ly|TikTok|Line\/)/i.exec(userAgent);
  if (!match) return null;
  const name = match[1].toLowerCase();
  if (name.startsWith("fba")) return "facebook";
  if (name === "musical_ly") return "tiktok";
  if (name === "line/") return "line";
  return name;
}
