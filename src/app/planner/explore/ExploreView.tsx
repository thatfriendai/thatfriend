"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { HomeNav } from "@/components/planner/HomeNav";
import { TripCover } from "@/components/planner/TripCover";
import { tintFor } from "@/lib/planner/cover";
import { kindColor } from "@/lib/planner/itinerary";
import {
  GUIDES,
  GUIDE_TYPES,
  GUIDE_KIND_TO_PLACE_KIND,
  TYPE_COLORS,
  type Guide,
  type GuideType,
} from "@/lib/planner/guides";
import { TRIP_TYPES } from "@/lib/supabase/planner-types";

export interface TripCard {
  id: string;
  name: string;
  destination: string | null;
  monthYear: string | null;
  ownerName: string;
  ownerUsername: string | null;
  placeCount: number;
  saved: boolean;
  tripType: string | null;
}

const TRIP_TYPE_TAB = "Trip type" as const;
const FRIENDS_TRIPS_TAB = "Friends’ trips" as const;
const ALL_TRIP_TYPES = "All types" as const;

type FilterChoice = GuideType | typeof TRIP_TYPE_TAB | typeof FRIENDS_TRIPS_TAB;

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

function firstPlace(destination: string | null, fallback: string) {
  return (destination || fallback).split(",")[0].trim();
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

function CloneGuideButton({ guideId, label, fullWidth }: { guideId: string; label: string; fullWidth?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clone() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/v2/guides/${guideId}/clone`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPending(false);
      setError(data.error ?? "Could not copy this guide.");
      return;
    }
    router.push(`/planner/trips/${data.tripId}`);
  }

  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={clone}
        disabled={pending}
        className={`rounded-full bg-accent px-5 py-2.5 text-[14px] text-on-accent hover:opacity-90 disabled:opacity-60 ${
          fullWidth ? "w-full" : ""
        }`}
      >
        {pending ? "Copying…" : label}
      </button>
      {error && <span className="text-[12.5px] text-red-700">{error}</span>}
    </div>
  );
}

function GuideCover({ guide, size }: { guide: Guide; size: "card" | "hero" }) {
  return (
    <TripCover
      place={guide.city.split(",")[0]}
      tint={TYPE_COLORS[guide.type]}
      placeCount={`${guide.places.length} places`}
      size={size}
    />
  );
}

function GuideKicker({ type }: { type: GuideType }) {
  return (
    <span
      className="flex-none rounded-full border px-2.5 py-1 font-mono text-[9.5px] tracking-[0.1em] uppercase"
      style={{ color: TYPE_COLORS[type], borderColor: TYPE_COLORS[type] }}
    >
      {type}
    </span>
  );
}

// Shared by the "Friends' trips" and "Trip type" tabs — same card grid,
// different title/subtitle/source array and empty copy.
function TripsGrid({
  trips,
  title,
  subtitle,
  count,
  emptyLine,
  emptyHint,
}: {
  trips: TripCard[];
  title: string;
  subtitle: string;
  count: string;
  emptyLine: string;
  emptyHint?: string;
}) {
  return (
    <>
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="mb-1 font-display text-[26px] tracking-tight text-ink">{title}</h2>
          <p className="text-[14px] text-muted">{subtitle}</p>
        </div>
        <span className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">{count}</span>
      </div>

      {trips.length === 0 ? (
        <div className="mb-10 rounded-2xl border border-dashed border-input-border p-8 text-center">
          <p className="mb-1 text-[15px] text-ink">{emptyLine}</p>
          {emptyHint && <p className="text-[13px] text-muted">{emptyHint}</p>}
        </div>
      ) : (
        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trips.map((t) => (
            <div key={t.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative h-[168px]">
                <TripCover
                  place={firstPlace(t.destination, t.name)}
                  tint={tintFor(t.id)}
                  placeCount={`${t.placeCount} place${t.placeCount === 1 ? "" : "s"}`}
                  size="card"
                />
                <div className="absolute top-2.5 right-2.5">
                  <SaveTripButton tripId={t.id} initialSaved={t.saved} />
                </div>
              </div>
              <div className="p-4">
                <p className="text-[15px] text-ink">{t.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted uppercase">
                  {[t.destination, t.monthYear].filter(Boolean).join(" · ")}
                </p>
                {t.tripType && (
                  <span className="mt-2 mb-1 inline-block rounded-full bg-[#F4F0F5] px-2.5 py-1 font-mono text-[9.5px] tracking-[0.1em] text-[#6E5A7A] uppercase">
                    {t.tripType}
                  </span>
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
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
    </>
  );
}

export function ExploreView({
  friendsTrips,
  fofTrips,
  publicTrips,
  navInitial,
  navUsername,
  navTripsCount,
  signOutAction,
}: {
  friendsTrips: TripCard[];
  fofTrips: TripCard[];
  publicTrips: TripCard[];
  navInitial: string;
  navUsername: string | null;
  navTripsCount: number;
  signOutAction: () => Promise<void>;
}) {
  // A link like /planner/explore?guide=g1 (Home's "From the guides"
  // cards) should land straight on that guide, in its own category tab —
  // read once on mount, not synced back to the URL afterward.
  const searchParams = useSearchParams();
  const linkedGuide = GUIDES.find((g) => g.id === searchParams.get("guide")) ?? null;

  const [filter, setFilter] = useState<FilterChoice>(linkedGuide?.type ?? GUIDE_TYPES[0]);
  const [openGuideId, setOpenGuideId] = useState<string | null>(linkedGuide?.id ?? null);
  const [showAllPlaces, setShowAllPlaces] = useState(false);

  const [scope, setScope] = useState<"friends" | "fof">("friends");
  const [query, setQuery] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [tripTypeFilter, setTripTypeFilter] = useState<string>(ALL_TRIP_TYPES);

  const trips = scope === "friends" ? friendsTrips : fofTrips;

  const filteredTrips = useMemo(() => {
    const q = committedQuery.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter(
      (t) => t.ownerName.toLowerCase().includes(q) || (t.destination ?? "").toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
    );
  }, [trips, committedQuery]);

  const typeFilteredTrips = useMemo(
    () => (tripTypeFilter === ALL_TRIP_TYPES ? publicTrips : publicTrips.filter((t) => t.tripType === tripTypeFilter)),
    [publicTrips, tripTypeFilter]
  );

  const openGuide = openGuideId ? GUIDES.find((g) => g.id === openGuideId) ?? null : null;
  const matchingGuides =
    filter === FRIENDS_TRIPS_TAB || filter === TRIP_TYPE_TAB ? [] : GUIDES.filter((g) => g.type === filter);
  const heroGuide = matchingGuides[0] ?? null;
  const restGuides = matchingGuides.slice(1);

  function openGuideDetail(id: string) {
    setOpenGuideId(id);
    setShowAllPlaces(false);
  }

  return (
    <div className="min-h-screen">
      <HomeNav initial={navInitial} username={navUsername} tripsCount={navTripsCount} signOutAction={signOutAction} />

      <div className="mx-auto max-w-[1180px] px-6 py-10 pb-28 sm:px-10">
        {openGuide ? (
          <GuideDetail
            guide={openGuide}
            showAllPlaces={showAllPlaces}
            onToggleAllPlaces={() => setShowAllPlaces((v) => !v)}
            onBack={() => setOpenGuideId(null)}
            backLabel={`← Back to ${filter.toLowerCase()}`}
          />
        ) : (
          <>
            <div className="mb-6 max-w-[700px]">
              <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-faint uppercase">Guides</p>
              <h1 className="mb-3 text-[42px] leading-[1.05] font-display tracking-tight text-ink">
                Someone already did the research
              </h1>
              <p className="text-[15.5px] leading-relaxed text-body">
                Filming locations, insider lists, and the routes our organizers keep converging on. Copy any guide into a trip in
                one tap.
              </p>
            </div>

            <div className="mb-10 flex flex-wrap gap-2">
              {[...GUIDE_TYPES, TRIP_TYPE_TAB, FRIENDS_TRIPS_TAB].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFilter(label)}
                  className={`rounded-full border px-4 py-1.5 text-[13.5px] transition-colors ${
                    filter === label ? "border-ink bg-ink text-cream" : "border-input-border bg-card text-body"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {filter === TRIP_TYPE_TAB ? (
              <>
                <h2 className="mb-3 max-w-[640px] text-[30px] leading-[1.08] font-display tracking-tight text-ink">
                  Trips like the one you are planning
                </h2>
                <p className="mb-6 max-w-[600px] text-[14.5px] leading-relaxed text-body">
                  Every public trip, grouped by what kind of trip it was. Pick a type and see how other people ran it.
                </p>

                <div className="mb-9 flex flex-wrap gap-2">
                  {[ALL_TRIP_TYPES, ...TRIP_TYPES].map((t) => {
                    const count = t === ALL_TRIP_TYPES ? publicTrips.length : publicTrips.filter((p) => p.tripType === t).length;
                    const on = tripTypeFilter === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTripTypeFilter(t)}
                        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13.5px] transition-colors ${
                          on ? "border-ink bg-ink text-cream" : "border-input-border bg-card text-body"
                        }`}
                      >
                        <span>{t}</span>
                        <span className={`font-mono text-[10.5px] ${on ? "text-cream/70" : "text-faint"}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>

                <TripsGrid
                  trips={typeFilteredTrips}
                  title={tripTypeFilter === ALL_TRIP_TYPES ? "All public trips" : `${tripTypeFilter} trips`}
                  subtitle={
                    tripTypeFilter === ALL_TRIP_TYPES
                      ? "Every public trip, newest first."
                      : `Public ${tripTypeFilter.toLowerCase()} trips, newest first.`
                  }
                  count={`${typeFilteredTrips.length} trip${typeFilteredTrips.length === 1 ? "" : "s"}`}
                  emptyLine={tripTypeFilter === ALL_TRIP_TYPES ? "No trips here yet." : `No public ${tripTypeFilter.toLowerCase()} trips yet.`}
                  emptyHint="Try another type, or make one of your own trips public."
                />
              </>
            ) : filter === FRIENDS_TRIPS_TAB ? (
              <>
                <h2 className="mb-3 max-w-[640px] text-[30px] leading-[1.08] font-display tracking-tight text-ink">
                  Where your friends have actually been
                </h2>
                <p className="mb-8 max-w-[600px] text-[14.5px] leading-relaxed text-body">
                  Their real itineraries, with the places they rated. Search a person or a city, save what you want, copy it into
                  a trip when you go.
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

                <TripsGrid
                  trips={filteredTrips}
                  title="From your friends"
                  subtitle="Public trips from people you follow, newest first."
                  count={`${filteredTrips.length} trip${filteredTrips.length === 1 ? "" : "s"}`}
                  emptyLine={committedQuery ? "Nothing matches that search." : "Nothing public here yet."}
                />

                <div className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-input-border p-6">
                  <div>
                    <p className="mb-1 text-[15px] text-ink">Running out of friends&rsquo; trips?</p>
                    <p className="text-[13px] leading-relaxed text-muted">
                      Public trips from people your friends follow show up here too, marked as second-degree. Nothing is public
                      unless its owner made it so.
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
              </>
            ) : (
              <>
                {heroGuide && (
                  <div className="mb-5 grid overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-2">
                    <div className="relative h-[320px] sm:h-auto">
                      <GuideCover guide={heroGuide} size="hero" />
                    </div>
                    <div className="flex flex-col gap-3.5 p-8">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <GuideKicker type={heroGuide.type} />
                        <span className="font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">
                          {heroGuide.city} · {heroGuide.places.length} places
                        </span>
                      </div>
                      <h2 className="font-display text-[30px] leading-[1.1] tracking-tight text-ink">{heroGuide.title}</h2>
                      <p className="text-[15px] leading-relaxed text-body">{heroGuide.blurb}</p>
                      {heroGuide.byline && (
                        <div className="flex items-center gap-2 text-[13.5px] text-body">
                          <span
                            className="flex h-6.5 w-6.5 items-center justify-center rounded-full text-[11px] text-cream"
                            style={{ background: TYPE_COLORS[heroGuide.type] }}
                          >
                            {initialsOf(heroGuide.byline)}
                          </span>
                          {heroGuide.credit}
                        </div>
                      )}
                      <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-3">
                        <button
                          type="button"
                          onClick={() => openGuideDetail(heroGuide.id)}
                          className="rounded-full bg-ink px-6 py-2.5 text-[14.5px] text-cream hover:bg-accent"
                        >
                          Open the guide
                        </button>
                        <CloneGuideButton guideId={heroGuide.id} label="Copy into a trip" />
                      </div>
                    </div>
                  </div>
                )}

                {restGuides.length > 0 && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {restGuides.map((g) => (
                      <div key={g.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
                        <div className="relative h-[150px]">
                          <GuideCover guide={g} size="card" />
                        </div>
                        <div className="flex flex-1 flex-col gap-2.5 p-4.5">
                          <GuideKicker type={g.type} />
                          <p className="text-[16.5px] leading-tight text-ink">{g.title}</p>
                          <p className="font-mono text-[10px] tracking-[0.08em] text-faint uppercase">
                            {g.city} · {g.places.length} places
                          </p>
                          <div className="mt-auto flex items-center gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => openGuideDetail(g.id)}
                              className="rounded-full border border-input-border bg-transparent px-4 py-2 text-[13.5px] text-body hover:border-ink"
                            >
                              Open
                            </button>
                            <CloneGuideButton guideId={g.id} label="Copy into a trip" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {matchingGuides.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-input-border p-11 text-center">
                    <p className="mb-1.5 text-[16px] text-ink">No guides in this category yet.</p>
                    <p className="text-[14px] text-muted">Check back soon, or try another category.</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GuideDetail({
  guide,
  showAllPlaces,
  onToggleAllPlaces,
  onBack,
  backLabel,
}: {
  guide: Guide;
  showAllPlaces: boolean;
  onToggleAllPlaces: () => void;
  onBack: () => void;
  backLabel: string;
}) {
  const hasMore = guide.places.length > 8;
  const visiblePlaces = showAllPlaces || !hasMore ? guide.places : guide.places.slice(0, 6);

  return (
    <div className="max-w-[960px]">
      <button type="button" onClick={onBack} className="mb-6 text-[14px] text-body hover:text-ink">
        {backLabel}
      </button>

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <GuideKicker type={guide.type} />
        <span className="font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">
          {guide.city} · {guide.places.length} places
        </span>
      </div>
      <h1 className="mb-7 max-w-[22em] text-[38px] leading-[1.08] font-display tracking-tight text-ink">{guide.title}</h1>

      <div className="relative mb-7 h-[280px] overflow-hidden rounded-2xl border border-border">
        <GuideCover guide={guide} size="hero" />
      </div>

      <div className="flex flex-wrap items-start gap-9">
        <div className="min-w-0 flex-[1_1_520px]">
          <p className="mb-2.5 font-mono text-[11px] tracking-[0.14em] text-faint uppercase">Why this guide exists</p>
          <p className="mb-3.5 text-[16.5px] leading-relaxed text-ink-body">{guide.why1}</p>
          <p className="mb-8 text-[15px] leading-relaxed text-body">{guide.why2}</p>

          <div className="mb-3.5 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-[26px] tracking-tight text-ink">The places</h2>
            <span className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">{guide.places.length} places</span>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {visiblePlaces.map((p) => (
              <div key={p.name} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="flex-none rounded-full px-2.5 py-1 font-mono text-[9.5px] tracking-[0.1em] uppercase"
                    style={{ background: kindColor(GUIDE_KIND_TO_PLACE_KIND[p.kind]), color: "var(--color-on-dark)" }}
                  >
                    {p.kind}
                  </span>
                  {p.keep && (
                    <span className="flex-none rounded-full border border-positive px-2.5 py-1 font-mono text-[9.5px] tracking-[0.1em] text-positive uppercase">
                      Worth going
                    </span>
                  )}
                </div>
                <p className="text-[15.5px] leading-tight text-ink">{p.name}</p>
                <p className="flex-1 text-[13.5px] leading-relaxed text-body">{p.note}</p>
                <p className="border-t border-border-soft pt-2 font-mono text-[10px] tracking-[0.08em] text-faint uppercase">
                  {p.where}
                </p>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={onToggleAllPlaces}
              className="mt-3.5 w-full rounded-full border border-input-border bg-transparent px-4 py-2.5 text-[14px] text-body hover:border-ink"
            >
              {showAllPlaces ? "Show fewer" : `Show all ${guide.places.length} places`}
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-[1_1_258px] flex-col gap-4.5">
          <div className="rounded-2xl border border-border-soft bg-warm-bg p-5.5">
            <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-faint uppercase">{guide.creditLabel}</p>
            <div className="mb-2.5 flex items-center gap-2.5">
              {guide.byline && (
                <span
                  className="flex h-7.5 w-7.5 items-center justify-center rounded-full text-[12px] text-cream"
                  style={{ background: TYPE_COLORS[guide.type] }}
                >
                  {initialsOf(guide.byline)}
                </span>
              )}
              <p className="text-[15px] leading-tight text-ink">{guide.credit}</p>
            </div>
            <p className="text-[13.5px] leading-relaxed text-body">{guide.creditNote}</p>
            {guide.sourceHref && (
              <a href={guide.sourceHref} className="mt-2.5 inline-block text-[13.5px] underline underline-offset-[3px]">
                {guide.sourceLabel}
              </a>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card px-5.5 py-1.5">
            {guide.facts.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-3.5 border-b border-border-soft py-3.5 last:border-0">
                <span className="flex-none font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">{f.label}</span>
                <span className="text-right text-[14.5px] text-ink">{f.value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border-[1.5px] border-accent bg-card p-5.5">
            <p className="mb-1.5 text-[16px] text-ink">Make it a real trip</p>
            <p className="mb-3.5 text-[13.5px] leading-relaxed text-body">{guide.cloneNote}</p>
            <CloneGuideButton guideId={guide.id} label="Copy into a trip" fullWidth />
          </div>
        </div>
      </div>
    </div>
  );
}
