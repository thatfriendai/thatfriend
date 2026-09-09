"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HomeNav } from "@/components/planner/HomeNav";

export interface FriendChip {
  id: string;
  name: string;
  username: string | null;
  tripCount: number;
}

export interface TripCard {
  id: string;
  name: string;
  destination: string | null;
  monthYear: string | null;
  ownerName: string;
  ownerUsername: string | null;
  placeCount: number;
  saved: boolean;
}

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

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill={filled ? "currentColor" : "none"} aria-hidden="true">
      <path d="M4 2.5h8a.5.5 0 0 1 .5.5v10.5l-4.5-3-4.5 3V3a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function SaveTripButton({ tripId, initialSaved }: { tripId: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !saved;
    setSaved(next);
    setPending(true);
    const res = await fetch(`/api/v2/trips/${tripId}/save`, { method: next ? "POST" : "DELETE" });
    setPending(false);
    if (!res.ok) setSaved(!next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={saved ? "Unsave trip" : "Save trip"}
      aria-pressed={saved}
      className={`flex h-8 w-8 items-center justify-center rounded-full border shadow disabled:opacity-50 ${
        saved ? "border-accent bg-card text-accent" : "border-border bg-card text-ink"
      }`}
    >
      <BookmarkIcon filled={saved} />
    </button>
  );
}

export function ExploreView({
  friendChips,
  fofChips,
  friendsTrips,
  fofTrips,
  navInitial,
  navUsername,
  navTripsCount,
  navSavedCount,
  signOutAction,
}: {
  friendChips: FriendChip[];
  fofChips: FriendChip[];
  friendsTrips: TripCard[];
  fofTrips: TripCard[];
  navInitial: string;
  navUsername: string | null;
  navTripsCount: number;
  navSavedCount: number;
  signOutAction: () => Promise<void>;
}) {
  const [scope, setScope] = useState<"friends" | "fof">("friends");
  const [query, setQuery] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");

  const chips = scope === "friends" ? friendChips : fofChips;
  const trips = scope === "friends" ? friendsTrips : fofTrips;

  const filteredTrips = useMemo(() => {
    const q = committedQuery.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter(
      (t) => t.ownerName.toLowerCase().includes(q) || (t.destination ?? "").toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
    );
  }, [trips, committedQuery]);

  return (
    <div className="min-h-screen">
      <HomeNav
        initial={navInitial}
        username={navUsername}
        tripsCount={navTripsCount}
        savedCount={navSavedCount}
        signOutAction={signOutAction}
      />

      <div className="mx-auto max-w-[1080px] px-6 py-10 pb-28 sm:px-10">
        <h1 className="mb-3 max-w-[720px] text-[42px] leading-[1.05] font-display tracking-tight text-ink">
          Where your friends have actually been
        </h1>
        <p className="mb-8 max-w-[640px] text-[15px] leading-relaxed text-body">
          Their real itineraries, with the places they rated. Search a person or a city, save what you
          want, copy it into a trip when you go.
        </p>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-full border border-input-border bg-card px-5 py-3">
            <span className="text-muted" aria-hidden="true">
              🔍
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setCommittedQuery(query);
              }}
              placeholder={'A friend, or a city — "Maya", "Lisbon"'}
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </div>
          <button
            type="button"
            onClick={() => setCommittedQuery(query)}
            className="rounded-full bg-ink px-7 py-3 text-[14.5px] text-cream hover:bg-accent"
          >
            Search
          </button>
        </div>

        <div className="mb-10 flex gap-2">
          <button
            type="button"
            onClick={() => setScope("friends")}
            className={`rounded-full px-4 py-1.5 text-[13.5px] ${
              scope === "friends" ? "bg-accent text-on-accent" : "border border-input-border bg-card text-ink"
            }`}
          >
            Friends
          </button>
          <button
            type="button"
            onClick={() => setScope("fof")}
            className={`rounded-full px-4 py-1.5 text-[13.5px] ${
              scope === "fof" ? "bg-accent text-on-accent" : "border border-input-border bg-card text-ink"
            }`}
          >
            Friends of friends
          </button>
        </div>

        {chips.length > 0 && (
          <div className="mb-10">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
                {scope === "friends" ? "Friends who travel" : "Friends of friends who travel"}
              </p>
              <Link href="/planner/friends" className="text-[13px] text-body hover:text-accent">
                All friends &rarr;
              </Link>
            </div>
            <div className="flex flex-wrap gap-3">
              {chips.slice(0, 8).map((f) => {
                const inner = (
                  <>
                    <div
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] text-cream"
                      style={{ background: "var(--color-accent)" }}
                    >
                      {initialsOf(f.name)}
                    </div>
                    <div>
                      <div className="text-[13.5px] text-ink-body">{f.name}</div>
                      <div className="text-[11.5px] text-faint">
                        {f.tripCount} trip{f.tripCount === 1 ? "" : "s"}
                      </div>
                    </div>
                  </>
                );
                return f.username ? (
                  <Link
                    key={f.id}
                    href={`/planner/u/${f.username}`}
                    className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-4 pl-1.5 hover:border-input-border"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={f.id} className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-4 pl-1.5">
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <h2 className="mb-1 font-display text-[26px] tracking-tight text-ink">From your friends</h2>
            <p className="text-[14px] text-muted">Public trips from people you follow, newest first.</p>
          </div>
          <span className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">
            {filteredTrips.length} trip{filteredTrips.length === 1 ? "" : "s"}
          </span>
        </div>

        {filteredTrips.length === 0 ? (
          <p className="mb-10 text-[14px] text-muted">
            {committedQuery ? "Nothing matches that search." : "Nothing public here yet."}
          </p>
        ) : (
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredTrips.map((t) => (
              <div key={t.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div
                  className="relative flex h-28 items-end p-2.5"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, var(--color-line) 0, var(--color-line) 1px, transparent 1px, transparent 10px)",
                    backgroundColor: "var(--color-surface-sunk)",
                  }}
                >
                  <div className="absolute top-2.5 right-2.5">
                    <SaveTripButton tripId={t.id} initialSaved={t.saved} />
                  </div>
                  <span className="font-mono text-[9.5px] tracking-[0.06em] text-muted uppercase">
                    Photo · {(t.destination || "no photo yet").toUpperCase()}
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-[15px] text-ink">{t.name}</p>
                  <p className="mt-0.5 mb-3 font-mono text-[11px] text-muted uppercase">
                    {[t.destination, t.monthYear].filter(Boolean).join(" · ")}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    {t.ownerUsername ? (
                      <Link
                        href={`/planner/u/${t.ownerUsername}`}
                        className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-body hover:text-accent"
                      >
                        <span
                          className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[9px] text-cream"
                          style={{ background: "var(--color-accent)" }}
                        >
                          {initialsOf(t.ownerName)}
                        </span>
                        <span className="truncate">{t.ownerName}</span>
                      </Link>
                    ) : (
                      <span className="text-[12.5px] text-body">{t.ownerName}</span>
                    )}
                    <span className="flex-none text-[12px] text-muted">
                      {t.placeCount} place{t.placeCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-input-border p-6">
          <div>
            <p className="mb-1 text-[15px] text-ink">Running out of friends&rsquo; trips?</p>
            <p className="text-[13px] leading-relaxed text-muted">
              Public trips from people your friends follow show up here too, marked as second-degree.
              Nothing is public unless its owner made it so.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setScope("fof")}
            disabled={scope === "fof"}
            className="whitespace-nowrap rounded-full border border-input-border bg-card px-4 py-2 text-[13px] text-ink hover:border-ink disabled:opacity-50"
          >
            Widen to friends of friends
          </button>
        </div>
      </div>
    </div>
  );
}
