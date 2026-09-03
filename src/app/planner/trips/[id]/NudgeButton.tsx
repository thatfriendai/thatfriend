"use client";

import { useState } from "react";

export function NudgeButton({ tripId }: { tripId: string }) {
  const [pendingMode, setPendingMode] = useState<"individual" | "group" | null>(null);
  const [result, setResult] = useState<{ error?: string; sentCount?: number } | null>(null);

  async function nudge(mode: "individual" | "group") {
    setPendingMode(mode);
    setResult(null);
    const res = await fetch(`/api/v2/trips/${tripId}/nudge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json().catch(() => ({}));
    setPendingMode(null);
    setResult(data);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => nudge("individual")}
        disabled={pendingMode !== null}
        className="rounded-full border border-input-border bg-card px-4 py-2 text-[13.5px] text-ink hover:border-ink disabled:opacity-50"
      >
        {pendingMode === "individual" ? "Nudging…" : "Nudge people who haven't answered"}
      </button>
      <button
        type="button"
        onClick={() => nudge("group")}
        disabled={pendingMode !== null}
        className="rounded-full border border-input-border bg-card px-4 py-2 text-[13.5px] text-ink hover:border-ink disabled:opacity-50"
      >
        {pendingMode === "group" ? "Sending…" : "Nudge the group"}
      </button>
      {result?.error && <span className="text-[13px] text-muted">{result.error}</span>}
      {result?.sentCount !== undefined && (
        <span className="text-[13px] text-accent">
          Sent {result.sentCount} nudge{result.sentCount === 1 ? "" : "s"} via text.
        </span>
      )}
    </div>
  );
}
