"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PreferencesSkipControl({
  tripId,
  skipped,
}: {
  tripId: string;
  skipped: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/v2/trips/${tripId}/preferences/skip`, {
        method: skipped ? "DELETE" : "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  if (skipped) {
    return (
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-4">
        <p className="text-[14px] text-body">
          Preferences skipped — this trip goes straight to planning.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="text-[13.5px] text-muted underline hover:text-accent disabled:opacity-50"
          >
            {pending ? "Undoing…" : "Undo"}
          </button>
          {error && <span className="text-[13px] text-red-700">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="text-[13.5px] text-muted underline hover:text-accent disabled:opacity-50"
      >
        {pending ? "Skipping…" : "We've already decided — skip this"}
      </button>
      {error && <p className="mt-1 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
