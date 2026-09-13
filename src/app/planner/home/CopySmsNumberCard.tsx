"use client";

import { useState } from "react";

export function CopySmsNumberCard({ smsNumber }: { smsNumber: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!smsNumber) return;
    try {
      await navigator.clipboard.writeText(smsNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied (permissions, insecure context) —
      // the number is still shown in the card text either way.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!smsNumber}
      className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-5.5 text-left transition-colors hover:border-ink disabled:cursor-default disabled:hover:border-border"
    >
      <span className="font-mono text-[10px] tracking-[0.12em] text-accent uppercase">Text it in</span>
      <span className="font-display text-[25px] leading-[1.15] text-ink">Forward a link, any time</span>
      <span className="text-[14.5px] leading-relaxed text-muted">
        {smsNumber
          ? copied
            ? `Copied ${smsNumber} — text it a recommendation and it lands on the right trip.`
            : `Tap to copy ${smsNumber}. Send it a recommendation and it lands on the right trip.`
          : "Forward a recommendation and it lands on the right trip."}
      </span>
    </button>
  );
}
