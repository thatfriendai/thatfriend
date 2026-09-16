"use client";

import { useState } from "react";

export function TextItInBar({ smsNumber }: { smsNumber: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!smsNumber) return;
    try {
      await navigator.clipboard.writeText(smsNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied (permissions, insecure context) —
      // the number is still shown in the bar text either way.
    }
  }

  return (
    <div className="mb-11 flex flex-wrap items-center gap-4.5 rounded-2xl border border-warm-border bg-warm-bg px-5.5 py-4.5">
      <span className="flex-none font-mono text-[10.5px] tracking-[0.12em] text-accent uppercase">Text it in</span>
      <span className="min-w-[240px] flex-1 text-[15px] text-body">
        {smsNumber
          ? `Forward any link to ${smsNumber} and it lands on the right trip.`
          : "Forward a recommendation and it lands on the right trip."}
      </span>
      <button
        type="button"
        onClick={copy}
        disabled={!smsNumber}
        className="flex-none rounded-full border border-input-border px-4.5 py-2.5 text-[14px] text-ink hover:border-ink disabled:cursor-default disabled:opacity-50"
      >
        {copied ? "Copied" : "Copy number"}
      </button>
    </div>
  );
}
