"use client";

import { useState } from "react";

export function NudgeButton({ tripId }: { tripId: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ error?: string; sentCount?: number } | null>(null);

  async function nudge() {
    setPending(true);
    setResult(null);
    const res = await fetch(`/api/v2/trips/${tripId}/nudge`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    setResult(data);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={nudge}
        disabled={pending}
        className="rounded-full border border-input-border bg-card px-4 py-2 text-[13.5px] text-ink hover:border-ink disabled:opacity-50"
      >
        {pending ? "Nudging…" : "Nudge people who haven't answered"}
      </button>
      {result?.error && <span className="text-[13px] text-muted">{result.error}</span>}
      {result?.sentCount !== undefined && (
        <span className="text-[13px] text-accent">
          Sent {result.sentCount} nudge{result.sentCount === 1 ? "" : "s"} via WhatsApp.
        </span>
      )}
    </div>
  );
}
