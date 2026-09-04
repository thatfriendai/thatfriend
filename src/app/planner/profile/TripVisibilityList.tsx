"use client";

import { useState } from "react";

interface TripRow {
  id: string;
  name: string;
  is_public: boolean;
}

export function TripVisibilityList({ trips }: { trips: TripRow[] }) {
  const [state, setState] = useState(trips);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function toggle(tripId: string, next: boolean) {
    setPendingId(tripId);
    const res = await fetch(`/api/v2/trips/${tripId}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: next }),
    });
    setPendingId(null);
    if (!res.ok) return;
    setState((list) => list.map((t) => (t.id === tripId ? { ...t, is_public: next } : t)));
  }

  if (state.length === 0) {
    return <p className="text-[14px] text-muted">No trips yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {state.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
        >
          <span className="text-[14.5px] text-ink-soft">{t.name}</span>
          <button
            type="button"
            onClick={() => toggle(t.id, !t.is_public)}
            disabled={pendingId === t.id}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] disabled:opacity-50 ${
              t.is_public ? "bg-ink text-cream" : "border border-input-border bg-card text-muted"
            }`}
          >
            {t.is_public ? "Public" : "Private"}
          </button>
        </div>
      ))}
    </div>
  );
}
