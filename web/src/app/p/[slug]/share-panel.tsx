"use client";

import { useState } from "react";
import { recordLinkShared } from "./actions";

export function SharePanel({
  planId,
  slug,
  headline,
  highlight,
}: {
  planId: string;
  slug: string;
  headline: string;
  highlight: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const url = () => `${window.location.origin}/p/${slug}`;
  const message = () => `${headline}\n${url()}`;

  async function copy() {
    await navigator.clipboard.writeText(url());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    void recordLinkShared(planId, "copy");
  }

  async function nativeShare() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ text: headline, url: url() });
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
