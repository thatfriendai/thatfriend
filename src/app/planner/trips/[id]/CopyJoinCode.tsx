"use client";

import { useState } from "react";

export function CopyJoinCode({ code, smsNumber }: { code: string; smsNumber: string | null }) {
  const [copied, setCopied] = useState(false);
  const text = smsNumber ? `HELLO ${code}` : code;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied — the code is still shown either way.
    }
  }

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-4.5">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[15px] tracking-[0.08em] text-ink">{code}</div>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {smsNumber ? `Or text "HELLO ${code}" to ${smsNumber} to join by text.` : "Have friends use this code to join."}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="flex-none rounded-[10px] bg-ink px-5 py-3 text-[14.5px] whitespace-nowrap text-cream hover:bg-accent"
      >
        {copied ? "Copied!" : "Copy code"}
      </button>
    </div>
  );
}
