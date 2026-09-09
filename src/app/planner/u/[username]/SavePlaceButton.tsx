"use client";

import { useState } from "react";

export interface SavePlaceCandidate {
  placeId: string;
  tripId: string;
  ownerId: string;
  name: string;
  kind: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  googlePlaceId: string | null;
  photoUrl: string | null;
}

export function SavePlaceButton({ place }: { place: SavePlaceCandidate }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (saved) {
    return <span className="text-[12.5px] text-muted">Saved</span>;
  }

  async function save() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/v2/saved-places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_place_id: place.placeId,
        source_trip_id: place.tripId,
        source_user_id: place.ownerId,
        name: place.name,
        kind: place.kind,
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        google_place_id: place.googlePlaceId,
        photo_url: place.photoUrl,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.duplicate ? "Already saved." : (data.error ?? "Could not save it."));
      return;
    }
    setSaved(true);
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[12.5px] text-ink hover:border-ink disabled:opacity-50"
      >
        {pending ? "…" : "Save place"}
      </button>
      {error && <span className="text-[11.5px] text-red-700">{error}</span>}
    </div>
  );
}
