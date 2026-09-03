"use client";

import { useState } from "react";

export function StartGroupText({
  tripId,
  started,
}: {
  tripId: string;
  started: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [number, setNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(started);

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
    setNumber(data.number ?? null);
  }

  if (isStarted && !number) {
    return (
      <span className="text-[13px] text-muted">
        Group text is live — everyone with a phone connected is in it.
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!isStarted && (
        <button
          type="button"
          onClick={start}
          disabled={pending}
          className="rounded-full border border-input-border bg-card px-4 py-2 text-[13.5px] text-ink hover:border-ink disabled:opacity-50"
        >
          {pending ? "Starting…" : "Start a group text with That Friend"}
        </button>
      )}
      {error && <span className="text-[13px] text-muted">{error}</span>}
      {number && (
        <span className="text-[13px] text-accent">
          Group text started — save {number} as &ldquo;That Friend&rdquo;.
        </span>
      )}
    </div>
  );
}
