"use client";

import { useState } from "react";

export interface SavedPlaceCandidate {
  name: string;
  kind: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  googlePlaceId: string | null;
  photoUrl: string | null;
}

export function AddToItineraryButton({
  savedPlaceId,
  place,
  trips,
  onAdded,
}: {
  savedPlaceId: string;
  place: SavedPlaceCandidate;
  trips: { id: string; name: string; days: { id: string; label: string }[] }[];
  onAdded: (info: { createdPlaceId: string; tripId: string; dayLabel: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tripId, setTripId] = useState(trips[0]?.id ?? "");
  const [dayId, setDayId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (trips.length === 0) {
    return <span className="text-[12.5px] text-muted">Start a trip first</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[12.5px] text-ink hover:border-ink"
      >
        Add to itinerary
      </button>
    );
  }

  const days = trips.find((t) => t.id === tripId)?.days ?? [];

  async function add() {
    if (!tripId) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/places`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: place.name,
        kind: place.kind,
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        google_place_id: place.googlePlaceId,
        photo_url: place.photoUrl,
        day_id: dayId || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPending(false);
      setError(data.duplicate ? "Already on that trip." : (data.error ?? "Could not add it."));
      return;
    }
    await fetch(`/api/v2/saved-places/${savedPlaceId}`, { method: "DELETE" });
    setPending(false);
    const dayLabel = days.find((d) => d.id === dayId)?.label ?? null;
    onAdded({ createdPlaceId: data.place.id, tripId, dayLabel });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={tripId}
        onChange={(e) => {
          setTripId(e.target.value);
          setDayId("");
        }}
        className="rounded-full border border-input-border bg-card px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-ink"
      >
        {trips.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {days.length > 0 && (
        <select
          value={dayId}
          onChange={(e) => setDayId(e.target.value)}
          className="rounded-full border border-input-border bg-card px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-ink"
        >
          <option value="">Unscheduled</option>
          {days.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={add}
        disabled={pending}
        className="rounded-full bg-ink px-3 py-1.5 text-[12.5px] text-cream hover:bg-accent disabled:opacity-50"
      >
        {pending ? "…" : "Add"}
      </button>
      {error && <span className="text-[11.5px] text-red-700">{error}</span>}
    </div>
  );
}
