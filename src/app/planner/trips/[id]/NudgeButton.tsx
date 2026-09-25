"use client";

import { useEffect, useState } from "react";
import { NUDGE_COOLDOWN_HOURS } from "@/config/limits";
import { cooldownRemainingMs, formatRelativeTime } from "@/lib/planner/nudgeCooldown";

/**
 * The button only ever nudges the "preferences" stage (the "availability"
 * stage is cron-only today, see nudge.ts) — lastNudgedAt is that stage's
 * most recent planner_nudge_log row, computed server-side in page.tsx.
 */
export function NudgeButton({ tripId, lastNudgedAt }: { tripId: string; lastNudgedAt: string | null }) {
  const [pendingMode, setPendingMode] = useState<"individual" | "group" | null>(null);
  const [result, setResult] = useState<{ error?: string; sentCount?: number } | null>(null);
  const [lastSent, setLastSent] = useState(lastNudgedAt);
  // Re-render once the cooldown actually expires, rather than leaving the
  // button disabled a page-load stale after the window passes.
  const [, forceTick] = useState(0);
  const remainingMs = cooldownRemainingMs(lastSent, NUDGE_COOLDOWN_HOURS);
  const onCooldown = remainingMs > 0;

  useEffect(() => {
    if (!onCooldown) return;
    const t = setTimeout(() => forceTick((n) => n + 1), Math.min(remainingMs, 60_000));
    return () => clearTimeout(t);
  }, [onCooldown, remainingMs]);

  async function nudge(mode: "individual" | "group") {
    if (onCooldown) return;
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
    if (data.sentCount !== undefined) setLastSent(new Date().toISOString());
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => nudge("individual")}
        disabled={pendingMode !== null || onCooldown}
        className="rounded-full border border-input-border bg-card px-4 py-2 text-[13.5px] text-ink hover:border-ink disabled:opacity-50"
      >
        {pendingMode === "individual" ? "Nudging…" : "Nudge people who haven't answered"}
      </button>
      <button
        type="button"
        onClick={() => nudge("group")}
        disabled={pendingMode !== null || onCooldown}
        className="rounded-full border border-input-border bg-card px-4 py-2 text-[13.5px] text-ink hover:border-ink disabled:opacity-50"
      >
        {pendingMode === "group" ? "Sending…" : "Nudge the group"}
      </button>
      {onCooldown && lastSent && (
        <span className="text-[13px] text-muted">Nudged {formatRelativeTime(lastSent)}</span>
      )}
      {result?.error && <span className="text-[13px] text-muted">{result.error}</span>}
      {result?.sentCount !== undefined && (
        <span className="text-[13px] text-accent">
          Sent {result.sentCount} nudge{result.sentCount === 1 ? "" : "s"} via text.
        </span>
      )}
    </div>
  );
}
