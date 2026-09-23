import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";

export const alt = "An Upfor episode";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin.rpc("get_public_episode", { p_slug: slug });
  const activity = (data as { activity?: string } | null)?.activity ?? "a plan";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: "#0c0a09",
          color: "#fafaf9",
        }}
      >
        <div style={{ fontSize: 32, letterSpacing: 4, color: "#a8a29e" }}>UPFOR</div>
        <div style={{ fontSize: 72, fontWeight: 800, marginTop: 24 }}>{`Up for ${activity}`}</div>
      </div>
    ),
    size,
  );
}
