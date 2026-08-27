"use client";

import { useState } from "react";
import { KIND_OPTIONS, formatDayLabel } from "@/lib/planner/itinerary";
import type { PlaceKind, PlannerDay, PlannerPlace } from "@/lib/supabase/planner-types";

export function AddPlaceModal({
  tripId,
  days,
  open,
  onClose,
  onCreated,
}: {
  tripId: string;
  days: PlannerDay[];
  open: boolean;
  onClose: () => void;
  onCreated: (place: PlannerPlace) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PlaceKind>("Restaurants");
  const [note, setNote] = useState("");
  const [dayId, setDayId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setName("");
    setKind("Restaurants");
    setNote("");
    setDayId("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);

    const res = await fetch(`/api/v2/trips/${tripId}/places`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind, note, day_id: dayId || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save that place.");
      return;
    }

    onCreated(data.place);
    reset();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(27,25,23,0.35)] px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl border border-border bg-cream"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6.5 py-5">
          <div className="font-display text-[23px] text-ink">Add a place</div>
          <button
            onClick={onClose}
            className="text-xl leading-none text-muted hover:text-ink"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4.5 px-6.5 py-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ramiro"
              className="w-full rounded-xl border border-input-border bg-card px-4 py-3 text-[15px] text-ink outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Kind</label>
            <div className="flex flex-wrap gap-2">
              {KIND_OPTIONS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  onClick={() => setKind(k.kind)}
                  className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
                    kind === k.kind
                      ? "border-transparent text-cream"
                      : "border-input-border bg-card text-ink-soft hover:border-ink"
                  }`}
                  style={kind === k.kind ? { background: k.color } : undefined}
                >
                  {k.kind}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Day <span className="text-muted">(optional)</span>
            </label>
            <select
              value={dayId}
              onChange={(e) => setDayId(e.target.value)}
              className="w-full rounded-xl border border-input-border bg-card px-4 py-3 text-[15px] text-ink outline-none focus:border-ink"
            >
              <option value="">No day yet</option>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDayLabel(d.date)}
                  {d.city ? ` · ${d.city}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Note <span className="text-muted">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Book two weeks out."
              className="w-full resize-y rounded-xl border border-input-border bg-card px-4 py-3 text-[15px] text-ink outline-none focus:border-ink"
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="mt-1 flex items-center gap-4">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-ink px-6.5 py-3 text-[15px] text-cream hover:bg-accent disabled:opacity-50"
            >
              {pending ? "Saving…" : "Add to the doc"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
