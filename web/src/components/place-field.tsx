"use client";

import { useEffect, useState } from "react";
import { PlacePin } from "@/components/place-pin";
import type { PlaceDraft, PlaceHit } from "@/lib/place";

export function PlaceField({
  value,
  onChange,
}: {
  value: PlaceDraft;
  onChange: (value: PlaceDraft) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceHit[]>([]);
  const [settledQuery, setSettledQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const hasPin = value.lat != null && value.lng != null;
  const typed = query.trim();
  const settled = settledQuery === typed;

  useEffect(() => {
    if (typed.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      setSettledQuery(typed);
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    setSearchError(null);
    const timer = window.setTimeout(() => {
      void fetch(`/api/places?q=${encodeURIComponent(typed)}`, { signal: controller.signal })
        .then(async (response) => {
          const body = (await response.json()) as { results?: PlaceHit[]; error?: string };
          if (!response.ok) throw new Error(body.error || "Map search is unavailable.");
          setResults(body.results ?? []);
          setSettledQuery(typed);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setResults([]);
          setSettledQuery(typed);
          setSearchError("Map search is unavailable. Type the place instead.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 800);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [typed]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Where (optional)</span>
        <input
          className="input"
          placeholder="Café de Jaren, or paste a maps link"
          maxLength={500}
          value={value.text}
          onChange={(e) => {
            const text = e.target.value;
            onChange(text.trim() ? { text, lat: value.lat, lng: value.lng } : { text, lat: null, lng: null });
          }}
        />
      </label>

      {hasPin && (
        <>
          <PlacePin name={value.text} lat={value.lat!} lng={value.lng!} showName={false} />
          <button
            type="button"
            className="self-start text-sm text-stone-500 underline"
            onClick={() => onChange({ text: value.text, lat: null, lng: null })}
          >
            Remove pin
          </button>
        </>
      )}

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Or search OpenStreetMap</span>
          <input
            className="input"
            placeholder="Search a venue"
            maxLength={80}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
          />
        </label>
        {searching && <p className="text-sm text-stone-500">Searching…</p>}
        {searchError && <p className="text-sm text-red-700">{searchError}</p>}
        {settled && results.length > 0 && (
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {results.map((hit) => (
              <li key={hit.id} className="border-b border-stone-100 last:border-b-0">
                <button
                  type="button"
                  className="flex w-full flex-col gap-0.5 px-4 py-3 text-left active:bg-stone-100"
                  onClick={() => {
                    onChange({ text: hit.name, lat: hit.lat, lng: hit.lng });
                    setQuery("");
                    setResults([]);
                  }}
                >
                  <span className="font-medium">{hit.name}</span>
                  {hit.detail && <span className="line-clamp-2 text-sm text-stone-500">{hit.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {settled && !searching && !searchError && typed.length >= 2 && results.length === 0 && (
          <p className="text-sm text-stone-500">No venues found. Type the place instead.</p>
        )}
        <p className="text-xs text-stone-500">
          Search by{" "}
          <a href="https://www.openstreetmap.org/copyright" className="underline" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>
        </p>
      </div>
    </div>
  );
}
