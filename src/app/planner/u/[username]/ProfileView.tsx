"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { kindColor } from "@/lib/planner/itinerary";
import { FollowButton } from "./FollowButton";
import { CopyTripButton } from "./CopyTripButton";
import { AskToJoinButton } from "./AskToJoinButton";
import { EditRatingButton } from "./EditRatingButton";
import { SavePlaceButton } from "./SavePlaceButton";
import { MakePrivateButton } from "./MakePrivateButton";

export interface RatingCardData {
  id: string;
  placeId: string;
  tripId: string;
  name: string;
  kind: string;
  rating: number;
  body: string | null;
  location: string | null;
  monthYear: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  googlePlaceId: string | null;
  photoUrl: string | null;
}

export interface VisitedPlaceRow {
  id: string;
  name: string;
  tripName: string;
  dayLabel: string | null;
}

export interface TripCardData {
  id: string;
  name: string;
  destination: string | null;
  dateRange: string | null;
  placeCount: number;
  travellerCount: number;
  canAskToJoin: boolean;
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

export function ProfileView({
  username,
  ownerId,
  label,
  firstName,
  tagline,
  location,
  avatarUrl,
  isSelf,
  publicTripCount,
  ratedCount,
  followersCount,
  mutualFriendsCount,
  isFollowingInitial,
  viewerSignedIn,
  feed: initialFeed,
  visits,
  unratedVisitCount,
  firstUnratedTripId,
  recentViewerCount,
  trips: initialTrips,
  privateTripCount: initialPrivateTripCount,
}: {
  username: string;
  ownerId: string;
  label: string;
  firstName: string;
  tagline: string | null;
  location: string | null;
  avatarUrl: string | null;
  isSelf: boolean;
  publicTripCount: number;
  ratedCount: number;
  followersCount: number;
  mutualFriendsCount: number;
  isFollowingInitial: boolean;
  viewerSignedIn: boolean;
  feed: RatingCardData[];
  visits: VisitedPlaceRow[];
  unratedVisitCount: number;
  firstUnratedTripId: string | null;
  recentViewerCount: number;
  trips: TripCardData[];
  privateTripCount: number;
}) {
  const [previewMode, setPreviewMode] = useState<"self" | "visitor">("self");
  const effectiveSelf = isSelf && previewMode === "self";

  const [feed, setFeed] = useState(initialFeed);
  const [trips, setTrips] = useState(initialTrips);
  const [privateTripCount, setPrivateTripCount] = useState(initialPrivateTripCount);
  const [kindFilter, setKindFilter] = useState<string>("All");

  const kinds = useMemo(() => [...new Set(feed.map((r) => r.kind))], [feed]);
  const visibleFeed = kindFilter === "All" ? feed : feed.filter((r) => r.kind === kindFilter);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-card px-5 py-5 sm:px-10">
        <Link href="/planner/home" className="text-[23px] tracking-tight font-display text-ink">
          &ldquo;that friend&rdquo;
        </Link>
        {isSelf && (
          <Link href="/planner/profile" className="text-[13.5px] text-body hover:text-accent">
            Edit profile
          </Link>
        )}
      </header>

      {isSelf && (
        <div className="flex items-center justify-between gap-4 border-b border-border bg-surface-warm px-6 py-3 sm:px-10">
          <span className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
            Preview &middot; thatfriend.co/@{username}
          </span>
          <div className="flex overflow-hidden rounded-full border border-input-border">
            <button
              type="button"
              onClick={() => setPreviewMode("visitor")}
              className={`px-4 py-1.5 text-[13px] ${previewMode === "visitor" ? "bg-ink text-cream" : "bg-card text-ink"}`}
            >
              As a visitor
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("self")}
              className={`px-4 py-1.5 text-[13px] ${previewMode === "self" ? "bg-ink text-cream" : "bg-card text-ink"}`}
            >
              As you
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[900px] px-6 py-13 pb-28">
        <div className="mb-12 flex items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-16 w-16 flex-none rounded-full object-cover" />
            ) : (
              <div
                className="flex h-16 w-16 flex-none items-center justify-center rounded-full text-[20px] text-on-accent"
                style={{ background: "var(--color-accent)" }}
              >
                {initialsOf(label)}
              </div>
            )}
            <div>
              <h1 className="mb-1 text-[32px] leading-[1.1] font-display tracking-tight text-ink">{label}</h1>
              <p className="mb-3 font-mono text-[12px] tracking-[0.04em] text-muted uppercase">
                @{username}
                {location ? ` · ${location}` : ""}
              </p>
              {tagline && <p className="mb-3 text-[14.5px] text-body">{tagline}</p>}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-body">
                <div>
                  <span className="mr-1.5 font-display text-[19px] text-ink">{publicTripCount}</span>
                  public trips
                </div>
                <div>
                  <span className="mr-1.5 font-display text-[19px] text-ink">{ratedCount}</span>
                  places rated
                </div>
                <div>
                  <span className="mr-1.5 font-display text-[19px] text-ink">{followersCount}</span>
                  followers
                </div>
              </div>
            </div>
          </div>

          {effectiveSelf ? (
            <div className="text-right">
              <Link
                href="/planner/profile"
                className="rounded-full border border-input-border bg-card px-5 py-2.5 text-[14px] text-ink hover:border-ink"
              >
                Edit profile
              </Link>
              <p className="mt-2 text-[12px] text-faint">Bio and photo live in Settings</p>
            </div>
          ) : (
            <div className="text-right">
              {viewerSignedIn ? (
                <FollowButton username={username} initialFollowing={isFollowingInitial} />
              ) : (
                <Link href="/planner/login" className="rounded-full bg-accent px-6 py-2.5 text-[14px] text-on-accent">
                  Follow
                </Link>
              )}
              {!isSelf && mutualFriendsCount > 0 && (
                <p className="mt-2 text-[12px] text-faint">
                  {mutualFriendsCount} friend{mutualFriendsCount === 1 ? "" : "s"} in common
                </p>
              )}
            </div>
          )}
        </div>

        {effectiveSelf && unratedVisitCount > 0 && (
          <div className="mb-10 rounded-2xl border border-warm-border bg-warm-bg p-5">
            <p className="mb-1.5 text-[15px] text-ink-body">
              {recentViewerCount > 0
                ? `${recentViewerCount} ${recentViewerCount === 1 ? "person" : "people"} looked at your profile this month — rate a few places while it's fresh.`
                : "Rate the places from your trips while it's fresh."}
            </p>
            <div className="flex items-center justify-between gap-4">
              <p className="text-[13.5px] text-muted">
                {unratedVisitCount} place{unratedVisitCount === 1 ? "" : "s"} not rated yet
              </p>
              {firstUnratedTripId && (
                <Link
                  href={`/planner/trips/${firstUnratedTripId}/reviews`}
                  className="rounded-full bg-ink px-4 py-2 text-[13px] text-cream hover:bg-accent"
                >
                  Rate now
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="mb-12">
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-[26px] tracking-tight text-ink">
              {feed.length > 0
                ? effectiveSelf
                  ? "Places you rated"
                  : `Places ${firstName} rated`
                : effectiveSelf
                  ? "Places you've visited"
                  : `Places ${firstName} has visited`}
            </h2>
            {feed.length > 0 && (
              <span className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">Highest first</span>
            )}
          </div>
          <p className="mb-5 text-[14px] text-muted">
            {feed.length > 0
              ? effectiveSelf
                ? "These are what visitors see first. Ratings come from the nudge after each trip."
                : "Rated after the trip, not saved before it. That's the difference between a wishlist and a recommendation."
              : "Not rated yet — nothing to sort until then."}
          </p>

          {feed.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setKindFilter("All")}
                className={`rounded-full px-4 py-1.5 text-[13px] ${
                  kindFilter === "All" ? "bg-ink text-cream" : "border border-input-border bg-card text-ink"
                }`}
              >
                All
              </button>
              {kinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKindFilter(k)}
                  className={`rounded-full px-4 py-1.5 text-[13px] ${
                    kindFilter === k ? "bg-ink text-cream" : "border border-input-border bg-card text-ink"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          )}

          {feed.length === 0 ? (
            visits.length === 0 ? (
              <p className="text-[14px] text-muted">Nothing visited yet.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {visits.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <div>
                      <div className="text-[14.5px] text-ink-body">{v.name}</div>
                      <div className="mt-0.5 text-[12px] text-muted">
                        {v.tripName}
                        {v.dayLabel ? ` · ${v.dayLabel}` : ""}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-ink-ghost uppercase">Not rated</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleFeed.map((r) => (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="mb-1.5 flex items-start justify-between gap-3">
                    <p className="text-[16px] text-ink">{r.name}</p>
                    <span className="flex-none rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] text-ink">
                      {r.rating}/5
                    </span>
                  </div>
                  <p className="mb-3 font-mono text-[11px] tracking-[0.04em] text-faint uppercase">
                    {[r.location, r.monthYear].filter(Boolean).join(" · ")}
                  </p>
                  {r.body && <p className="mb-4 text-[13.5px] leading-relaxed text-body">{r.body}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span
                      className="rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.06em] uppercase"
                      style={{ background: `${kindColor(r.kind)}17`, color: kindColor(r.kind) }}
                    >
                      {r.kind}
                    </span>
                    {effectiveSelf ? (
                      <EditRatingButton
                        tripId={r.tripId}
                        placeId={r.placeId}
                        rating={r.rating}
                        body={r.body}
                        onSaved={(rating, body) =>
                          setFeed((f) => f.map((x) => (x.id === r.id ? { ...x, rating, body } : x)))
                        }
                      />
                    ) : viewerSignedIn ? (
                      <SavePlaceButton
                        place={{
                          placeId: r.placeId,
                          tripId: r.tripId,
                          ownerId,
                          name: r.name,
                          kind: r.kind,
                          lat: r.lat,
                          lng: r.lng,
                          address: r.address,
                          googlePlaceId: r.googlePlaceId,
                          photoUrl: r.photoUrl,
                        }}
                      />
                    ) : (
                      <Link href="/planner/login" className="text-[12.5px] text-muted hover:text-accent">
                        Sign in to save
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {trips.length > 0 && (
            <div className="mt-6 border-t border-border-soft pt-5">
              <p className="mb-2.5 font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">
                Itineraries these came from
              </p>
              <div className="flex flex-wrap gap-2">
                {trips.map((t) => (
                  <a
                    key={t.id}
                    href="#trips"
                    className="rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[12.5px] text-ink-body hover:border-ink"
                  >
                    {t.name}
                    <span className="ml-1.5 text-faint">{t.placeCount}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div id="trips">
          <h2 className="mb-1 font-display text-[26px] tracking-tight text-ink">Trips</h2>
          <p className="mb-5 text-[14px] text-muted">
            {effectiveSelf
              ? "Public trips only. Private ones stay off this page."
              : "Open one to see the full itinerary, or copy it into a trip of your own."}
          </p>

          {trips.length === 0 ? (
            <p className="text-[14px] text-muted">Nothing public yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {trips.map((t) => (
                <div key={t.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div
                    className="relative flex h-24 items-end p-2.5"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(45deg, var(--color-line) 0, var(--color-line) 1px, transparent 1px, transparent 10px)",
                      backgroundColor: "var(--color-surface-sunk)",
                    }}
                  >
                    {effectiveSelf && (
                      <span className="absolute top-2.5 right-2.5 rounded-full bg-ink px-2 py-0.5 font-mono text-[9px] tracking-[0.08em] text-cream uppercase">
                        Public
                      </span>
                    )}
                    <span className="font-mono text-[9.5px] tracking-[0.06em] text-muted uppercase">
                      Photo · {(t.destination || "no photo yet").toUpperCase()}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="text-[15px] text-ink">{t.name}</p>
                    <p className="mt-0.5 mb-3 font-mono text-[11px] text-muted uppercase">
                      {[t.destination, t.dateRange].filter(Boolean).join(" · ")}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-muted">
                        {t.placeCount} place{t.placeCount === 1 ? "" : "s"} &middot; {t.travellerCount} traveller
                        {t.travellerCount === 1 ? "" : "s"}
                      </span>
                      {effectiveSelf ? (
                        <MakePrivateButton
                          tripId={t.id}
                          onMadePrivate={() => {
                            setTrips((list) => list.filter((x) => x.id !== t.id));
                            setPrivateTripCount((n) => n + 1);
                          }}
                        />
                      ) : t.canAskToJoin ? (
                        <AskToJoinButton tripId={t.id} />
                      ) : (
                        <CopyTripButton tripId={t.id} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {effectiveSelf && privateTripCount > 0 && (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-dashed border-input-border p-5">
              <div>
                <p className="text-[14.5px] text-ink">
                  {privateTripCount} more trip{privateTripCount === 1 ? "" : "s"} {privateTripCount === 1 ? "is" : "are"} private
                </p>
                <p className="text-[13px] text-muted">
                  Only you see these. Flip one to public and it appears here and in your friends&rsquo; Explore.
                </p>
              </div>
              <Link
                href="/planner/trips"
                className="whitespace-nowrap rounded-full border border-input-border bg-card px-4 py-2 text-[13px] text-ink hover:border-ink"
              >
                Manage privacy
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
