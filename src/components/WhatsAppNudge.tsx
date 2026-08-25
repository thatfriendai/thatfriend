"use client";

import { useState, useTransition } from "react";
import { sendNudges } from "@/app/trip/[id]/actions";

export function WhatsAppNudge({ tripId }: { tripId: string }) {
  const [result, setResult] = useState<{ error?: string; sentCount?: number } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  function nudge() {
    startTransition(async () => {
      setResult(await sendNudges(tripId));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={nudge}
        disabled={isPending}
        className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-ink hover:border-accent disabled:opacity-50"
      >
        {isPending ? "Nudging…" : "Nudge people who haven't answered"}
      </button>
      {result?.error && <span className="text-sm text-muted">{result.error}</span>}
      {result?.sentCount !== undefined && (
        <span className="text-sm text-accent">
          Sent {result.sentCount} nudge{result.sentCount === 1 ? "" : "s"} via
          WhatsApp.
        </span>
      )}
    </div>
  );
}
