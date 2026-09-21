"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DAY_COLORS, kindColor } from "@/lib/planner/itinerary";
import { CopyTripButton } from "@/app/planner/u/[username]/CopyTripButton";
import { AddToItineraryButton } from "./AddToItineraryButton";

export interface TripRowData {
  id: string;
  name: string;
  sub: string;
  dateLabel: string;
  hasDate: boolean;
  startDate: string | null;
  createdAt: string;
  travelers: number;
  answered: number;
  status: string;
  needs: boolean;
  urgency: number;
  cta: string;
  people: { name: string; initials: string }[];
}

export interface PastTripRow {
  id: string;
  name: string;
  destination: string | null;
  dateLabel: string;
  statusLabel: string;
}

export interface SavedTripRow {
  id: string;
  name: string;
  destination: string | null;
  dateRange: string | null;
  ownerName: string;
  placesCount: number;
  savedLabel: string;
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

type Tab = "yours" | "invited" | "saved";
type Sort = "urgency" | "date" | "added";

const SORTS: { id: Sort; label: string }[] = [
  { id: "urgency", label: "Needs you" },
  { id: "date", label: "Trip date" },
  { id: "added", label: "Recently added" },
];

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function sortRows(rows: TripRowData[], sort: Sort): TripRowData[] {
  const list = rows.slice();
  if (sort === "urgency") return list.sort((a, b) => b.urgency - a.urgency);
  if (sort === "date") {
    return list.sort((a, b) => {
      if (a.hasDate !== b.hasDate) return a.hasDate ? -1 : 1;
      if (!a.startDate || !b.startDate) return 0;
      return a.startDate.localeCompare(b.startDate);
    });
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const ROW_GRID = "sm:grid-cols-[4px_minmax(0,1fr)_110px_170px_100px_105px]";

function TripRow({ row }: { row: TripRowData }) {
  const dotColor = row.needs ? "var(--color-accent)" : row.travelers === 1 ? "var(--color-ink-ghost)" : "var(--color-positive)";
  return (
    <Link
      href={`/planner/trips/${row.id}`}
      className={`grid grid-cols-1 items-center gap-2 border-b border-border-soft py-5 hover:bg-card sm:gap-4 ${ROW_GRID}`}
    >
      <span className="hidden h-9.5 w-1 flex-none rounded-full sm:block" style={{ background: row.needs ? "var(--color-accent)" : "transparent" }} />
      <div className="min-w-0">
        <p className="font-display text-[25px] leading-tight text-ink">{row.name}</p>
        {row.sub && <p className="mt-0.5 text-[14px] text-muted">{row.sub}</p>}
      </div>
      <p className="font-mono text-[12.5px] tracking-[0.02em] text-ink-soft">{row.dateLabel}</p>
      <div className="flex min-w-0 items-center gap-2.5 text-[14.5px]">
        <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: dotColor }} />
        <span style={{ color: row.needs ? "var(--color-accent)" : "var(--color-ink-soft)" }}>{row.status}</span>
      </div>
      <div className="flex items-center">
        {row.people.map((p, i) => (
          <div
            key={i}
            title={p.name}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-canvas text-[10.5px] text-cream"
            style={{ background: DAY_COLORS[i % DAY_COLORS.length], marginLeft: i ? -9 : 0 }}
          >
            {p.initials}
          </div>
        ))}
      </div>
      <span
        className="text-right text-[14.5px] whitespace-nowrap"
        style={{ color: row.needs ? "var(--color-accent)" : "var(--color-ink-soft)" }}
      >
        {row.cta}
      </span>
    </Link>
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
  yoursLead,
  invitedLead,
  savedLead,
  yoursRows,
  invitedRows,
  pastTrips,
  savedTrips: initialSavedTrips,
  savedPlaces: initialSavedPlaces,
  ownTripsForPicker,
}: {
  yoursLead: string;
  invitedLead: string;
  savedLead: string;
  yoursRows: TripRowData[];
  invitedRows: TripRowData[];
  pastTrips: PastTripRow[];
  savedTrips: SavedTripRow[];
  savedPlaces: SavedPlaceRow[];
  ownTripsForPicker: OwnTripForPicker[];
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(initialTab === "saved" ? "saved" : initialTab === "invited" ? "invited" : "yours");
  const [sort, setSort] = useState<Sort>("urgency");
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

  const activeRows = tab === "invited" ? invitedRows : yoursRows;
  const sortedRows = useMemo(() => sortRows(activeRows, sort), [activeRows, sort]);
  const lead = tab === "saved" ? savedLead : tab === "invited" ? invitedLead : yoursLead;

  return (
    <div>
      <p className="mb-2.5 font-mono text-[11px] tracking-[0.14em] text-faint uppercase">Trips</p>
      <h1 className="mb-7 max-w-[18em] font-display text-[38px] leading-[1.08] tracking-tight text-ink">{lead}</h1>

      <div className="mb-1 flex flex-wrap items-center gap-4 border-b border-border pb-3.5">
        <div className="flex gap-1">
          {(
            [
              { id: "yours" as const, label: "Yours", count: yoursRows.length },
              { id: "invited" as const, label: "Invited", count: invitedRows.length },
              { id: "saved" as const, label: "Saved", count: savedTrips.length },
            ]
          ).map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="mr-3.5 inline-flex items-center gap-1.5 border-b-2 bg-transparent py-1.5 text-[15.5px]"
                style={{ borderColor: on ? "var(--color-ink)" : "transparent", color: on ? "var(--color-ink)" : "var(--color-muted)" }}
              >
                {t.label}
                <span className="font-mono text-[11px]" style={{ color: on ? "var(--color-ink-faint)" : "var(--color-ink-ghost)" }}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {tab !== "saved" && (
          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-[10.5px] tracking-[0.1em] text-faint uppercase">Sort</span>
            {SORTS.map((s) => {
              const on = sort === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSort(s.id)}
                  className={`rounded-full px-3.5 py-1.5 text-[13.5px] ${on ? "border border-ink bg-card text-ink" : "border border-transparent text-muted"}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {tab !== "saved" ? (
        <>
          <div className="mb-5">
            {sortedRows.length === 0 ? (
              <div className="mb-5 rounded-2xl border border-border bg-card px-7 py-8">
                <p className="mb-1.5 font-display text-2xl text-ink">
                  {tab === "invited" ? "No invitations right now" : "No trips yet"}
                </p>
                <p className="max-w-[40em] text-[15px] leading-relaxed text-body">
                  {tab === "invited"
                    ? "When someone adds you to a trip, it lands here and That Friend asks you the questions."
                    : "Name it, add three friends, and let That Friend do the asking."}
                </p>
              </div>
            ) : (
              sortedRows.map((row) => <TripRow key={row.id} row={row} />)
            )}
          </div>

          <div className="mb-13 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-input-border p-7 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div>
              <p className="mb-1.5 font-display text-2xl text-ink">The one you keep talking about</p>
              <p className="text-[15px] text-body">Name it, add three friends, and let That Friend do the asking.</p>
            </div>
            <Link
              href="/planner/trips/new"
              className="rounded-full border border-input-border bg-card px-6 py-3 text-[15px] whitespace-nowrap text-ink hover:border-ink"
            >
              Start a trip
            </Link>
          </div>

          <section>
            <div className="mb-4.5 flex items-baseline gap-4 border-b border-border pb-3">
              <p className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Past</p>
              <span className="ml-auto text-[13px] text-faint">
                {pastTrips.length === 0 ? "Nothing yet" : `${pastTrips.length} trip${pastTrips.length === 1 ? "" : "s"}`}
              </span>
            </div>
            {pastTrips.length === 0 ? (
              <p className="max-w-[40em] px-1 text-[15px] leading-relaxed text-muted">
                Nothing here yet. A trip moves down here a week after it ends, with everything the group decided still
                attached.
              </p>
            ) : (
              pastTrips.map((t) => (
                <Link
                  key={t.id}
                  href={`/planner/trips/${t.id}`}
                  className={`grid grid-cols-1 items-center gap-1.5 border-b border-border-soft py-4.5 text-ink hover:bg-card sm:gap-4 ${ROW_GRID}`}
                >
                  <span />
                  <div className="min-w-0">
                    <p className="font-display text-[22px] leading-tight text-ink-soft">{t.name}</p>
                    {t.destination && <p className="mt-0.5 text-[14px] text-faint">{t.destination}</p>}
                  </div>
                  <p className="font-mono text-[12.5px] text-muted">{t.dateLabel}</p>
                  <p className="text-[14px] text-muted">{t.statusLabel}</p>
                  <span />
                  <span className="text-right text-[14px] text-muted">Open &rarr;</span>
                </Link>
              ))
            )}
          </section>
        </>
      ) : (
        <>
          {savedTrips.length === 0 ? (
            <div className="mb-5 rounded-2xl border border-border bg-card px-7 py-8">
              <p className="mb-1.5 font-display text-2xl text-ink">Nothing saved yet</p>
              <p className="max-w-[40em] text-[15px] leading-relaxed text-body">
                Save a trip from Explore and it waits here, with the owner&rsquo;s places intact, until you start one
                of your own.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3">
                {savedTrips.map((t, i) => {
                  const initials = initialsOf(t.ownerName);
                  return (
                    <div
                      key={t.id}
                      className="grid grid-cols-1 items-center gap-2 border-b border-border-soft py-4.5 sm:grid-cols-[30px_minmax(0,1fr)_170px_140px_170px] sm:gap-4"
                    >
                      <span
                        className="flex h-7.5 w-7.5 flex-none items-center justify-center rounded-full text-[11px] text-cream"
                        style={{ background: DAY_COLORS[i % DAY_COLORS.length] }}
                      >
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-[23px] leading-tight text-ink">{t.name}</p>
                        <p className="mt-0.5 text-[14px] text-muted">
                          {t.placesCount} place{t.placesCount === 1 ? "" : "s"} &middot; {t.destination ?? t.name}
                        </p>
                      </div>
                      <p className="text-[14.5px] text-ink-soft">By {t.ownerName}</p>
                      <p className="text-[13.5px] text-muted">{t.savedLabel}</p>
                      <div className="flex items-center justify-start gap-3 sm:justify-end">
                        <CopyTripButton tripId={t.id} />
                        <RemoveTripButton
                          tripId={t.id}
                          onRemoved={() => setSavedTrips((list) => list.filter((x) => x.id !== t.id))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mb-11 max-w-[44em] text-[14px] leading-relaxed text-muted">
                Saved trips stay as the owner left them. Copy one into a trip of your own to change anything.
              </p>
            </>
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
          <span className="text-[13.5px]">Added to {undo.dayLabel ?? "the trip"}.</span>
          <button type="button" onClick={performUndo} className="text-[13.5px] font-medium text-cream underline hover:opacity-80">
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
