"use client";

import { useState } from "react";
import { pinShareText } from "@/lib/place";
import { recordLinkShared } from "./actions";

export function SharePanel({
  planId,
  slug,
  headline,
  highlight,
  pin,
}: {
  planId: string;
  slug: string;
  headline: string;
  highlight: boolean;
  pin?: { name: string; lat: number; lng: number } | null;
}) {
  const [copied, setCopied] = useState(false);

  const url = () => `${window.location.origin}/p/${slug}`;
  const message = () =>
    [headline, url(), pin ? pinShareText(pin.name, pin.lat, pin.lng) : null].filter(Boolean).join("\n");

  async function copy() {
    await navigator.clipboard.writeText(url());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    void recordLinkShared(planId, "copy");
  }

  async function nativeShare() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({
        text: pin ? `${headline}\n${pinShareText(pin.name, pin.lat, pin.lng)}` : headline,
        url: url(),
      });
      void recordLinkShared(planId, "native");
    } catch {
      // Closing the share sheet rejects; nothing to do.
    }
  }

  return (
    <section className={`card flex flex-col gap-3 ${highlight ? "border-stone-900" : ""}`}>
      <h2 className="text-lg font-semibold">
        {highlight ? "Your plan is live. Send it to the group chat." : "Share the plan"}
      </h2>
      {pin && <p className="text-sm text-stone-600">The message includes the pin, so it opens in another maps app.</p>}
      <div className="grid grid-cols-2 gap-2">
        <a
          className="btn-primary"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = `https://wa.me/?text=${encodeURIComponent(message())}`;
            void recordLinkShared(planId, "whatsapp");
          }}
        >
          WhatsApp
        </a>
        <a
          className="btn-secondary"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = `sms:&body=${encodeURIComponent(message())}`;
            void recordLinkShared(planId, "imessage");
          }}
        >
          iMessage
        </a>
        <button type="button" className="btn-secondary" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </button>
        <button type="button" className="btn-secondary" onClick={nativeShare}>
          More…
        </button>
      </div>
    </section>
  );
}
