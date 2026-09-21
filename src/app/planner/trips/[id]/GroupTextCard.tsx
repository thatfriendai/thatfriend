"use client";

import { useState } from "react";

/**
 * Step 3 of the invite flow — the organizer's side, and the reason the
 * order matters: this stays greyed out until the people she invited have
 * actually joined (each join is that person's own consent to trip texts,
 * see src/lib/planner/joinLink.ts), so when That Friend opens the group
 * thread, every number in it has already said yes. No stranger walking
 * into a group, nothing left on "listen only".
 *
 * Twilio can't be added to a native iMessage/SMS group from the phone side
 * (replies from the number would only ever reach the sender), so "adding
 * That Friend" means That Friend opens the thread: one text to everyone
 * who's joined, and from then on it's a group text from its number.
 */
export function GroupTextCard({
  tripId,
  started,
  number,
  othersJoined,
  pendingCount,
}: {
  tripId: string;
  started: boolean;
  number: string | null;
  othersJoined: number;
  pendingCount: number;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(started);
  const [copied, setCopied] = useState(false);

  const locked = !isStarted && (othersJoined === 0 || pendingCount > 0);

  async function start() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/conversation/start`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (data.error) {
      setError(data.error);
      return;
    }
    setIsStarted(true);
  }

  async function copyNumber() {
    if (!number) return;
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied — the number is still shown.
    }
  }

  const gateLine = isStarted
    ? `Live with everyone who's joined${number ? ` — save ${number} as "That Friend" so it shows up by name.` : "."}`
    : locked
      ? pendingCount > 0
        ? `Unlocks once your invited travelers have joined — ${pendingCount} still pending.`
        : "Unlocks once someone joins."
      : "Everyone who's joined already said yes to texts, so That Friend can jump straight in.";

  return (
    <div
      className={`rounded-2xl border p-4.5 transition-opacity ${
        locked ? "border-border-soft bg-surface-sunk opacity-60" : "border-border bg-card"
      }`}
      aria-disabled={locked}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[12em] flex-1">
          <p className="text-[15px] text-ink">{isStarted ? "That Friend is in your group text" : "Add That Friend to your group text"}</p>
          <p className="mt-1 text-[13.5px] leading-snug text-body">{gateLine}</p>
          {error && <p className="mt-1 text-[13px] text-red-700">{error}</p>}
        </div>
        {isStarted ? (
          number && (
            <button
              type="button"
              onClick={copyNumber}
              className="flex-none rounded-full border border-input-border bg-card px-4 py-2 text-[13.5px] text-ink hover:border-ink"
            >
              {copied ? "Copied!" : "Copy the number"}
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={locked || pending}
            className="flex-none rounded-full bg-ink px-4.5 py-2.5 text-[13.5px] text-cream hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-ink"
          >
            {pending ? "Starting…" : "Start the group text"}
          </button>
        )}
      </div>
    </div>
  );
}
