"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ExploreNav } from "@/components/planner/ExploreNav";
import { kindColor } from "@/lib/planner/itinerary";
import { CopyTripButton } from "@/app/planner/u/[username]/CopyTripButton";
import { AddToItineraryButton } from "./AddToItineraryButton";

export interface SavedTripRow {
  id: string;
  name: string;
  destination: string | null;
  dateRange: string | null;
  ownerName: string;
}

export interface SavedPlaceRow {
  id: string;
  name: string;
  kind: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  googlePlaceId: string | null;
  photoUrl: string | null;
  location: string | null;
  ownerName: string;
  sourcePlaceId: string | null;
  sourceTripId: string | null;
  sourceUserId: string | null;
}

export interface OwnTripForPicker {
  id: string;
  name: string;
  days: { id: string; label: string }[];
}

function StripePhoto({ label }: { label: string }) {
  return (
    <div
      className="flex h-16 w-16 flex-none items-center justify-center rounded-xl"
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, var(--color-line) 0, var(--color-line) 1px, transparent 1px, transparent 8px)",
        backgroundColor: "var(--color-surface-sunk)",
      }}
      title={label}
    />
  );
}

function RemoveTripButton({ tripId, onRemoved }: { tripId: string; onRemoved: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const res = await fetch(`/api/v2/trips/${tripId}/save`, { method: "DELETE" });
        setPending(false);
        if (res.ok) onRemoved();
      }}
      className="text-[12.5px] text-muted hover:text-ink disabled:opacity-50"
    >
      {pending ? "…" : "Remove"}
    </button>
  );
}

function RemovePlaceButton({ id, onRemoved }: { id: string; onRemoved: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const res = await fetch(`/api/v2/saved-places/${id}`, { method: "DELETE" });
        setPending(false);
        if (res.ok) onRemoved();
      }}
      className="text-[12.5px] text-muted hover:text-ink disabled:opacity-50"
    >
      {pending ? "…" : "Remove"}
    </button>
  );
}

export function TripsAndSavedView({
  children,
  tripsAndSavedCount,
  savedTrips: initialSavedTrips,
  savedPlaces: initialSavedPlaces,
  ownTripsForPicker,
  ownTripCount,
}: {
  children: ReactNode;
  tripsAndSavedCount: number;
  savedTrips: SavedTripRow[];
  savedPlaces: SavedPlaceRow[];
  ownTripsForPicker: OwnTripForPicker[];
  ownTripCount: number;
}) {
  const [tab, setTab] = useState<"yours" | "saved">("yours");
  const [savedTrips, setSavedTrips] = useState(initialSavedTrips);
  const [savedPlaces, setSavedPlaces] = useState(initialSavedPlaces);
  const [undo, setUndo] = useState<{ place: SavedPlaceRow; createdPlaceId: string; tripId: string; dayLabel: string | null } | null>(
    null
  );
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  function armUndo(place: SavedPlaceRow, info: { createdPlaceId: string; tripId: string; dayLabel: string | null }) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ place, ...info });
    undoTimer.current = setTimeout(() => setUndo(null), 8000);
  }

  async function performUndo() {
    if (!undo) return;
    const { place, createdPlaceId, tripId } = undo;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
    await fetch(`/api/v2/trips/${tripId}/places/${createdPlaceId}`, { method: "DELETE" });
    const res = await fetch("/api/v2/saved-places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_place_id: place.sourcePlaceId,
        source_trip_id: place.sourceTripId,
        source_user_id: place.sourceUserId,
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
    if (res.ok && data.savedPlace) {
      setSavedPlaces((list) => [{ ...place, id: data.savedPlace.id }, ...list]);
    }
  }

  return (
    <div>
      <ExploreNav active="trips" tripsAndSavedCount={tripsAndSavedCount} />

      <div className="mb-9 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("yours")}
          className={`rounded-full px-4 py-1.5 text-[13.5px] ${
            tab === "yours" ? "bg-accent text-on-accent" : "border border-input-border bg-card text-ink"
          }`}
        >
          Yours &middot; {ownTripCount}
        </button>
        <button
          type="button"
          onClick={() => setTab("saved")}
          className={`rounded-full px-4 py-1.5 text-[13.5px] ${
            tab === "saved" ? "bg-accent text-on-accent" : "border border-input-border bg-card text-ink"
          }`}
        >
          Saved &middot; {savedTrips.length}
        </button>
      </div>

      {tab === "yours" ? (
        children
      ) : (
        <>
          <h1 className="mb-2 text-[42px] leading-[1.06] font-display tracking-tight text-ink">Your trips</h1>
          <p className="mb-9 text-base text-body">
            Saved trips sit alongside your own, on your profile. They stay saved if the owner edits them,
            and disappear only if they go private.
          </p>

          {savedTrips.length === 0 ? (
            <p className="mb-11 text-[14px] text-muted">
              Nothing saved yet — bookmark a friend&rsquo;s trip from Explore.
            </p>
          ) : (
            <div className="mb-11 overflow-hidden rounded-2xl border border-border bg-card">
              {savedTrips.map((t, i) => (
                <div
                  key={t.id}
                  className={`flex flex-wrap items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-border-soft" : ""}`}
                >
                  <StripePhoto label={t.destination ?? t.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] text-ink">{t.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted uppercase">
                      {[t.destination, t.dateRange].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="text-[12.5px] whitespace-nowrap text-muted">Saved from {t.ownerName}</span>
                  <CopyTripButton tripId={t.id} />
                  <RemoveTripButton
                    tripId={t.id}
                    onRemoved={() => setSavedTrips((list) => list.filter((x) => x.id !== t.id))}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[26px] tracking-tight text-ink">Saved places</h2>
            <span className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">
              {savedPlaces.length} place{savedPlaces.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mb-5 text-[14px] text-muted">
            Spots you pulled out of someone&rsquo;s trip. Add one to a day and it leaves this list.
          </p>

          {savedPlaces.length === 0 ? (
            <p className="text-[14px] text-muted">Nothing saved yet.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {savedPlaces.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex flex-wrap items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-border-soft" : ""}`}
                >
                  <span
                    className="flex-none rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.06em] uppercase"
                    style={{ background: kindColor(p.kind), color: "var(--color-on-dark)" }}
                  >
                    {p.kind}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] text-ink">{p.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted uppercase">
                      {[p.location, `From ${p.ownerName}'s trip`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="text-[12.5px] whitespace-nowrap text-muted">Saved from {p.ownerName}</span>
                  <AddToItineraryButton
                    savedPlaceId={p.id}
                    place={p}
                    trips={ownTripsForPicker}
                    onAdded={(info) => {
                      setSavedPlaces((list) => list.filter((x) => x.id !== p.id));
                      armUndo(p, info);
                    }}
                  />
                  <RemovePlaceButton
                    id={p.id}
                    onRemoved={() => setSavedPlaces((list) => list.filter((x) => x.id !== p.id))}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {undo && (
        <div className="fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-full border border-border bg-ink px-5 py-3 text-cream shadow-lg">
          <span className="text-[13.5px]">
            Added to {undo.dayLabel ?? "the trip"}.
          </span>
          <button type="button" onClick={performUndo} className="text-[13.5px] font-medium text-cream underline hover:opacity-80">
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
