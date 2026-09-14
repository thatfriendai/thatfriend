"use client";

import { useState } from "react";

export function CopyJoinCode({
  tripId,
  code: initialCode,
  smsNumber,
}: {
  tripId: string;
  code: string | null;
  smsNumber: string | null;
}) {
  const [code, setCode] = useState(initialCode);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setGenerating(true);
    const res = await fetch(`/api/v2/trips/${tripId}/join-code`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setGenerating(false);
    if (res.ok && data.join_code) setCode(data.join_code);
  }

  if (!code) {
    // Trips created before this feature existed have no join code yet —
    // generated on demand instead of backfilling every row at once.
    return (
      <button
        type="button"
        onClick={generate}
        disabled={generating}
        className="rounded-full border border-input-border bg-card px-4 py-2.5 text-[14px] text-ink hover:border-ink disabled:opacity-50"
      >
        {generating ? "Generating…" : "Generate a join code"}
      </button>
    );
  }

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
