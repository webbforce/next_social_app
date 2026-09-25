/* eslint-disable @next/next/no-img-element -- ImageResponse only accepts <img>, not next/image */
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  statsLine,
  type EpisodeHighlights,
  type EpisodePhoto,
  type EpisodeTemplate,
} from "@/lib/episode";

export const CARD_SIZE = { width: 1080, height: 1920 };

const logoSrc = `data:image/png;base64,${(await readFile(join(process.cwd(), "public/logo.png"))).toString("base64")}`;

function grid(photos: EpisodePhoto[]) {
  const n = photos.length;
  if (n <= 1) return { cols: 1, cell: 900 };
  if (n === 2) return { cols: 2, cell: 430 };
  if (n <= 4) return { cols: 2, cell: 430 };
  return { cols: 3, cell: 280 };
}

function filmFrame(photo: EpisodePhoto) {
  return (
    <div
      key={photo.id}
      style={{ display: "flex", alignItems: "center", gap: 12, background: "#0B0B0B", padding: 12 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[0, 1, 2].map((n) => (
          <div key={n} style={{ width: 22, height: 16, borderRadius: 3, background: "#FAFAF8" }} />
        ))}
      </div>
      <img src={photo.url} alt="" width={760} height={280} style={{ objectFit: "cover" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[0, 1, 2].map((n) => (
          <div key={n} style={{ width: 22, height: 16, borderRadius: 3, background: "#FAFAF8" }} />
        ))}
      </div>
    </div>
  );
}

function polaroid(photo: EpisodePhoto, width: number, height: number) {
  return (
    <div
      key={photo.id}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        padding: 16,
        paddingBottom: 48,
      }}
    >
      <img src={photo.url} alt="" width={width} height={height} style={{ objectFit: "cover" }} />
    </div>
  );
}

export async function renderEpisodeCard(input: {
  activity: string;
  hostName: string;
  template: EpisodeTemplate;
  highlights: EpisodeHighlights;
  photos: EpisodePhoto[];
  link: string;
}) {
  const dark = input.template === "bold" || input.template === "filmstrip";
  const bg = dark ? "#0B0B0B" : "#FAFAF8";
  const fg = dark ? "#FAFAF8" : "#0B0B0B";
  const muted = dark ? "#a3a3a3" : "#525252";
  const { cell } = grid(input.photos);
  const shown = input.photos.slice(0, input.template === "filmstrip" ? 3 : input.template === "polaroid" ? 4 : 9);

  const response = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: bg,
          color: fg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={logoSrc} alt="" width={72} height={72} />
          <div style={{ fontSize: 36, fontWeight: 700, color: fg }}>upFor</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 36, color: muted }}>{`${input.hostName} was up for`}</div>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05 }}>{input.activity}</div>
          <div style={{ fontSize: 32, color: muted }}>{statsLine(input.highlights)}</div>
        </div>

        {input.template === "filmstrip" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {shown.map((p) => filmFrame(p))}
          </div>
        ) : input.template === "polaroid" ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
            {shown.map((p) => polaroid(p, shown.length > 1 ? 420 : 860, shown.length > 1 ? 320 : 640))}
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {shown.map((p) => (
              <img
                key={p.id}
                src={p.url}
                alt=""
                width={cell}
                height={cell}
                style={{ objectFit: "cover", borderRadius: input.template === "bold" ? 8 : 24 }}
              />
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[input.highlights.lastPhoto, input.highlights.busiest, input.highlights.topShooter]
            .filter(Boolean)
            .map((line) => (
              <div key={line} style={{ fontSize: 28, color: muted }}>
                {line}
              </div>
            ))}
          <div style={{ marginTop: 16, fontSize: 28, color: muted }}>{`made with upFor · ${input.link}`}</div>
        </div>
      </div>
    ),
    { ...CARD_SIZE, headers: { "content-type": "image/png" } },
  );

  return Buffer.from(await response.arrayBuffer());
}
