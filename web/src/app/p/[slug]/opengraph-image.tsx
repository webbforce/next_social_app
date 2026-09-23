import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPlanBySlug } from "@/lib/plan";
import { formatRange } from "@/lib/time";

const logoSrc = `data:image/png;base64,${(await readFile(join(process.cwd(), "public/logo.png"))).toString("base64")}`;

export const alt = "A plan on Upfor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const plan = await getPlanBySlug(slug);

  const who = plan?.host.first_name ?? "Someone";
  const activity = plan?.activity ?? "a plan";
  const when = plan ? formatRange(new Date(plan.starts_at), new Date(plan.ends_at)) : "";
  const status =
    plan?.status === "cancelled"
      ? "Cancelled"
      : plan?.status === "ended"
        ? "Ended"
        : plan && plan.in_count > 1
          ? `${plan.in_count} people are in`
          : "Tap to join";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#fafaf9",
          color: "#1c1917",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src={logoSrc} alt="" width={64} height={64} />
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 4, color: "#78716c" }}>UPFOR</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 44, color: "#57534e" }}>{`${who} is up for`}</div>
          <div style={{ fontSize: 104, fontWeight: 800, lineHeight: 1.05 }}>{activity}</div>
          {when && <div style={{ fontSize: 44 }}>{when}</div>}
        </div>
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            fontSize: 36,
            fontWeight: 600,
            padding: "14px 32px",
            borderRadius: 999,
            background: "#1c1917",
            color: "#fafaf9",
          }}
        >
          {status}
        </div>
      </div>
    ),
    size,
  );
}
