import { siteUrl } from "@/lib/site";
import type { PlaceHit } from "@/lib/place";

export const dynamic = "force-dynamic";

type NominatimRow = {
  place_id?: number;
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
};

const cache = new Map<string, { at: number; results: PlaceHit[] }>();
let lastRequestAt = 0;

function shortName(row: NominatimRow) {
  const named = row.name?.trim();
  if (named) return named.slice(0, 120);
  const first = row.display_name?.split(",")[0]?.trim() ?? "";
  return first.slice(0, 120);
}

function detailFor(row: NominatimRow, name: string) {
  const display = row.display_name?.trim() ?? "";
  if (display.toLowerCase().startsWith(name.toLowerCase())) {
    return display.slice(name.length).replace(/^,\s*/, "");
  }
  return display;
}

const AMENITY = /^(caf[eé]|coffee|bar|pub|restaurant|club)\s+/i;

function distinctiveTokens(query: string) {
  return query
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !AMENITY.test(`${token} `));
}

async function nominatim(query: string, country: boolean): Promise<NominatimRow[]> {
  const wait = 1100 - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("viewbox", "4.728,52.431,5.079,52.278");
  url.searchParams.set("bounded", "0");
  if (country) url.searchParams.set("countrycodes", "nl");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": `Upfor/1.0 (${siteUrl()})`,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("nominatim");
  return (await response.json()) as NominatimRow[];
}

function toHits(rows: NominatimRow[], query: string): PlaceHit[] {
  const tokens = distinctiveTokens(query);
  return rows.flatMap((row) => {
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    const name = shortName(row);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    if (tokens.length) {
      const hay = `${name} ${row.display_name ?? ""}`.toLocaleLowerCase();
      if (!tokens.some((token) => hay.includes(token))) return [];
    }
    return [{ id: String(row.place_id ?? `${lat},${lng}`), name, detail: detailFor(row, name), lat, lng }];
  });
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) return Response.json({ results: [] });

  const key = query.toLocaleLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return Response.json({ results: hit.results });

  try {
    let rows = await nominatim(query, true);
    if (!rows.length) {
      const stripped = query.replace(AMENITY, "").trim();
      if (stripped.length >= 2 && stripped !== query) rows = await nominatim(stripped, true);
    }
    if (!rows.length) rows = await nominatim(query, false);

    const results = toHits(rows, query);
    cache.set(key, { at: Date.now(), results });
    return Response.json({ results });
  } catch {
    return Response.json({ results: [], error: "Map search is unavailable." }, { status: 502 });
  }
}
