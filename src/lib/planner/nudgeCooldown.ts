/**
 * Pure cooldown/relative-time math for nudges — no "server-only" marker so
 * the same logic runs both in sendNudge (the actual gate) and in
 * NudgeButton (showing "Nudged 3h ago" / disabling itself) without the two
 * ever disagreeing about what "still on cooldown" means.
 */

/** Milliseconds left before another nudge for this (trip, stage) is allowed — 0 once the cooldown has passed, or if nothing's ever been sent. */
export function cooldownRemainingMs(lastSentAt: string | null, cooldownHours: number, now: Date = new Date()): number {
  if (!lastSentAt) return 0;
  const elapsed = now.getTime() - new Date(lastSentAt).getTime();
  return Math.max(0, cooldownHours * 60 * 60 * 1000 - elapsed);
}

/** "3h ago" / "just now" / "2d ago" — hour granularity, unlike the day-only relative-time spots elsewhere in this app. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
