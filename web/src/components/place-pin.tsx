"use client";

import { useState } from "react";
import { appleMapsUrl, googleMapsUrl, osmEmbedUrl, osmPinUrl, pinShareText } from "@/lib/place";

export function PlacePin({
  name,
  lat,
  lng,
  showName = true,
}: {
  name: string;
  lat: number;
  lng: number;
  showName?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copyPin() {
    await navigator.clipboard.writeText(pinShareText(name, lat, lng));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      {showName && <p className="text-stone-600">{name}</p>}
      <iframe
        title={`Map of ${name}`}
        src={osmEmbedUrl(lat, lng)}
        className="h-44 w-full rounded-2xl border border-stone-200"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="text-xs text-stone-500">
        Pin from{" "}
        <a href="https://www.openstreetmap.org/copyright" className="underline" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
        <a href={appleMapsUrl(lat, lng, name)} target="_blank" rel="noreferrer" className="underline">
          Apple Maps
        </a>
        <a href={googleMapsUrl(lat, lng)} target="_blank" rel="noreferrer" className="underline">
          Google Maps
        </a>
        <a href={osmPinUrl(lat, lng)} target="_blank" rel="noreferrer" className="underline">
          OpenStreetMap
        </a>
        <button type="button" className="underline" onClick={() => void copyPin()}>
          {copied ? "Copied" : "Copy pin"}
        </button>
      </div>
    </div>
  );
}
