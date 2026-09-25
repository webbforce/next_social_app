export type PlaceDraft = {
  text: string;
  lat: number | null;
  lng: number | null;
};

export type StoredPlace = {
  placeText: string | null;
  placeUrl: string | null;
  lat: number | null;
  lng: number | null;
};

export type PlaceHit = {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lng: number;
};

const empty: StoredPlace = { placeText: null, placeUrl: null, lat: null, lng: null };

function coord(raw: string) {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function parsePlaceFields(
  placeRaw: string,
  latRaw: string,
  lngRaw: string,
): { ok: true; place: StoredPlace } | { ok: false; error: string } {
  const place = placeRaw.trim();
  const lat = coord(latRaw.trim());
  const lng = coord(lngRaw.trim());
  const hasLat = latRaw.trim() !== "";
  const hasLng = lngRaw.trim() !== "";

  if (hasLat !== hasLng || Number.isNaN(lat) || Number.isNaN(lng)) {
    return { ok: false, error: "That pin isn't a real location." };
  }
  if (!place && !hasLat) return { ok: true, place: empty };

  const isUrl = /^https?:\/\/\S+$/i.test(place);
  if (!hasLat) {
    if (isUrl ? place.length > 500 : place.length > 120) {
      return { ok: false, error: "That place is too long." };
    }
    return {
      ok: true,
      place: isUrl ? { ...empty, placeUrl: place } : { ...empty, placeText: place },
    };
  }

  if (lat! < -90 || lat! > 90 || lng! < -180 || lng! > 180) {
    return { ok: false, error: "That pin isn't a real location." };
  }
  const name = (isUrl ? "" : place).slice(0, 120);
  if (!name) return { ok: false, error: "Name the place for this pin." };
  return {
    ok: true,
    place: {
      placeText: name,
      placeUrl: osmPinUrl(lat!, lng!),
      lat,
      lng,
    },
  };
}

export function pinFromUrl(url: string | null | undefined): { lat: number; lng: number } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "www.openstreetmap.org" && parsed.hostname !== "openstreetmap.org") return null;
    const lat = Number(parsed.searchParams.get("mlat"));
    const lng = Number(parsed.searchParams.get("mlon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
export function osmPinUrl(lat: number, lng: number) {
  const la = lat.toFixed(6);
  const ln = lng.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${la}&mlon=${ln}#map=18/${la}/${ln}`;
}

export function osmEmbedUrl(lat: number, lng: number) {
  const latPad = 0.004;
  const lngPad = 0.006;
  const bbox = [lng - lngPad, lat - latPad, lng + lngPad, lat + latPad].map((n) => n.toFixed(5)).join(",");
  const url = new URL("https://www.openstreetmap.org/export/embed.html");
  url.searchParams.set("bbox", bbox);
  url.searchParams.set("layer", "mapnik");
  url.searchParams.set("marker", `${lat.toFixed(6)},${lng.toFixed(6)}`);
  return url.toString();
}

export function appleMapsUrl(lat: number, lng: number, name: string) {
  const url = new URL("https://maps.apple.com/");
  url.searchParams.set("ll", `${lat},${lng}`);
  url.searchParams.set("q", name);
  return url.toString();
}

export function googleMapsUrl(lat: number, lng: number) {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${lat},${lng}`);
  return url.toString();
}

export function pinShareText(name: string, lat: number, lng: number) {
  return `${name}\n${osmPinUrl(lat, lng)}`;
}

function prefersAppleMaps(userAgent: string) {
  return /iPad|iPhone|iPod|Macintosh/.test(userAgent);
}

// The invite carries one maps link, for the phone that sends it: Apple Maps on Apple devices, Google Maps elsewhere.
export function nativeMapsUrl(lat: number, lng: number, name: string, userAgent: string) {
  return prefersAppleMaps(userAgent) ? appleMapsUrl(lat, lng, name) : googleMapsUrl(lat, lng);
}

export function inviteMessage(
  headline: string,
  planUrl: string,
  pin: { name: string; lat: number; lng: number } | null,
  userAgent: string,
) {
  const lines = [headline, `Open in upFor: ${planUrl}`];
  if (pin) lines.push(`${pin.name}: ${nativeMapsUrl(pin.lat, pin.lng, pin.name, userAgent)}`);
  return lines.join("\n");
}
