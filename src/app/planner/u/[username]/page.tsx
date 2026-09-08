import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { listFriends } from "@/lib/planner/follows";
import { FollowButton } from "./FollowButton";
import { CopyTripButton } from "./CopyTripButton";
import { AskToJoinButton } from "./AskToJoinButton";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDates(start: string | null, end: string | null) {
  if (!start) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(start + "T00:00:00").toLocaleDateString(undefined, opts).toUpperCase();
  if (!end) return s;
  const e = new Date(end + "T00:00:00").toLocaleDateString(undefined, opts).toUpperCase();
  return `${s}–${e}`;
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const viewer = await getPlannerUser();
  const admin = createAdminClient();

  const { data: profileUser } = await admin
    .from("planner_users")
    .select("id, name, username, tagline, is_public")
    .eq("username", username)
    .maybeSingle();
  if (!profileUser) notFound();

  const isSelf = viewer?.id === profileUser.id;

  if (!profileUser.is_public && !isSelf) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="mb-2 font-display text-2xl text-ink">This profile is private.</p>
          <p className="text-[14.5px] text-body">
            {profileUser.name || `@${username}`} hasn&rsquo;t made this visible to others.
          </p>
        </div>
      </div>
    );
  }

  const { data: memberships } = await admin
    .from("planner_memberships")
    .select(
      "trip_id, planner_trips(id, name, destination, start_date, end_date, is_public, dates_locked_at)"
    )
    .eq("user_id", profileUser.id);

  const allTrips = (memberships ?? [])
    .map(
      (m) =>
        m.planner_trips as unknown as {
          id: string;
          name: string;
          destination: string | null;
          start_date: string | null;
          end_date: string | null;
          is_public: boolean;
          dates_locked_at: string | null;
        } | null
    )
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const visibleTrips = isSelf ? allTrips : allTrips.filter((t) => t.is_public);
  const visibleTripIds = visibleTrips.map((t) => t.id);
  const today = new Date().toISOString().slice(0, 10);

  const nextTrip =
    visibleTrips
      .filter((t) => t.start_date && (!t.end_date || t.end_date >= today))
      .sort((a, b) => (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999"))[0] ?? null;

  const nightsAway = visibleTrips.reduce((sum, t) => {
    if (!t.start_date || !t.end_date) return sum;
    return sum + Math.max(0, Math.round((Date.parse(t.end_date) - Date.parse(t.start_date)) / 86400000));
  }, 0);
  const destinations = new Set(visibleTrips.map((t) => t.destination).filter(Boolean));

  let isFollowing = false;
  if (viewer && !isSelf) {
    const { data: followRow } = await admin
      .from("planner_follows")
      .select("follower_id")
      .eq("follower_id", viewer.id)
      .eq("followee_id", profileUser.id)
      .maybeSingle();
    isFollowing = Boolean(followRow);
  }

  const friends = await listFriends(admin, profileUser.id);

  // Feed (1b) vs. fallback (2a) — a render-time decision, not two routes:
  // the profile shows the taste feed once this person has rated at least
  // one place; until then it shows the honest "visited, not yet rated"
  // list instead of a blank feed with a call to action aimed at whoever's
  // looking. Nothing writes planner_place_ratings yet (that's the 2b
  // rating-capture flow, a separate pass) — every profile is in the 2a
  // state today, and that's correct, not a bug.
  const { data: ratingRows } =
    visibleTripIds.length > 0
      ? await admin
          .from("planner_place_ratings")
          .select("id, rating, body, created_at, trip_id, planner_places(id, name, photo_url)")
          .eq("user_id", profileUser.id)
          .in("trip_id", visibleTripIds)
          .order("rating", { ascending: false })
      : { data: [] };

  const tripNameById = new Map(visibleTrips.map((t) => [t.id, t.name]));
  const feed = (ratingRows ?? [])
    .map((r) => {
      const place = r.planner_places as unknown as { id: string; name: string; photo_url: string | null } | null;
      if (!place) return null;
      return {
        id: r.id,
        rating: r.rating as number,
        body: r.body as string | null,
        placeName: place.name,
        photoUrl: place.photo_url,
        tripName: tripNameById.get(r.trip_id) ?? "a trip",
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const endedTripIds = visibleTrips.filter((t) => t.end_date && t.end_date < today).map((t) => t.id);
  let visits: { placeName: string; tripName: string; dateRange: string | null }[] = [];
  if (feed.length === 0 && endedTripIds.length > 0) {
    const { data: visitedPlaces } = await admin
      .from("planner_places")
      .select("name, trip_id")
      .in("trip_id", endedTripIds)
      .not("day_id", "is", null);
    visits = (visitedPlaces ?? []).map((p) => {
      const trip = visibleTrips.find((t) => t.id === p.trip_id);
      return {
        placeName: p.name,
        tripName: trip?.name ?? "a trip",
        dateRange: trip ? formatDates(trip.start_date, trip.end_date) : null,
      };
    });
  }

  const label = profileUser.name || `@${profileUser.username}`;

  let canAskToJoin = false;
  if (!isSelf && viewer && nextTrip?.is_public) {
    const { data: viewerMembership } = await admin
      .from("planner_memberships")
      .select("trip_id")
      .eq("trip_id", nextTrip.id)
      .eq("user_id", viewer.id)
      .maybeSingle();
    canAskToJoin = !viewerMembership;
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-card px-5 py-5 sm:px-10">
        <Link href="/planner/trips" className="text-[23px] tracking-tight font-display text-ink">
          &ldquo;that friend&rdquo;
        </Link>
        {isSelf && (
          <Link href="/planner/profile" className="text-[13.5px] text-body hover:text-accent">
            Edit profile
          </Link>
        )}
      </header>

      <div className="mx-auto max-w-[760px] px-6 py-13 pb-28">
        <div className="mb-12 flex items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <div
              className="flex h-16 w-16 flex-none items-center justify-center rounded-full text-[20px] text-on-accent"
              style={{ background: "var(--color-accent)" }}
            >
              {initialsOf(label)}
            </div>
            <div>
              <h1 className="mb-1 text-[32px] leading-[1.1] font-display tracking-tight text-ink">
                {profileUser.name || `@${profileUser.username}`}
              </h1>
              {profileUser.tagline && <p className="mb-3 text-[14px] text-muted">{profileUser.tagline}</p>}
              <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[12px] text-body">
                <div>
                  <span className="text-[15px] font-medium text-ink">{visibleTrips.length}</span> trips
                </div>
                <div>
                  <span className="text-[15px] font-medium text-ink">{destinations.size}</span> places
                </div>
                <div>
                  <span className="text-[15px] font-medium text-ink">{nightsAway}</span> nights away
                </div>
                <div>
                  <span className="text-[15px] font-medium text-ink">{friends.length}</span> friends
                </div>
              </div>
            </div>
          </div>
          {!isSelf && viewer && <FollowButton username={username} initialFollowing={isFollowing} />}
        </div>

        {nextTrip && (
          <div className="mb-10 flex items-center justify-between gap-4 rounded-2xl border border-warm-border bg-warm-bg p-5">
            <div>
              <p className="mb-1 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">Coming up</p>
              <p className="mb-0.5 text-[16px] font-medium text-ink">{nextTrip.name}</p>
              <p className="font-mono text-[11px] text-muted">
                {formatDates(nextTrip.start_date, nextTrip.end_date) ?? "Dates open"}
                {nextTrip.destination ? ` · ${nextTrip.destination}` : ""}
              </p>
            </div>
            {canAskToJoin && <AskToJoinButton tripId={nextTrip.id} />}
          </div>
        )}

        {isSelf && visits.length > 0 && (
          <div className="mb-10 rounded-2xl border border-accent-tint bg-accent-wash p-5">
            <p className="mb-1 text-[15px] text-ink-body">Rate the places from your trips</p>
            <p className="text-[13.5px] text-muted">
              {visits.length} place{visits.length === 1 ? "" : "s"} you&rsquo;ve visited {visits.length === 1 ? "hasn't" : "haven't"} been rated yet.
            </p>
          </div>
        )}

        {feed.length > 0 ? (
          <div className="mb-12">
            <p className="mb-4 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
              {isSelf ? "Your taste" : `${label.split(" ")[0]}'s taste`} &middot; {feed.length}
            </p>
            <div className="flex flex-col gap-3">
              {feed.map((r) => (
                <div key={r.id} className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3.5">
                  {r.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photoUrl} alt="" className="h-12 w-12 flex-none rounded-lg object-cover" />
                  ) : (
                    <div className="h-12 w-12 flex-none rounded-lg bg-border-soft" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] text-ink-body">{r.placeName}</div>
                    <div className="mt-0.5 text-[12.5px] text-muted">{r.tripName}</div>
                    {r.body && <div className="mt-1 text-[13px] text-body">{r.body}</div>}
                  </div>
                  <div className="font-mono text-[13px] text-ink">{"★".repeat(r.rating)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-12">
            <p className="mb-4 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
              {isSelf ? "Places you've visited" : `Places ${label.split(" ")[0]} has visited`} &middot; {visits.length}
            </p>
            {visits.length === 0 ? (
              <p className="text-[14px] text-muted">Nothing visited yet.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {visits.map((v, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
                    <div>
                      <div className="text-[14.5px] text-ink-body">{v.placeName}</div>
                      <div className="mt-0.5 text-[12px] text-muted">
                        {v.tripName}
                        {v.dateRange ? ` · ${v.dateRange}` : ""}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-ink-ghost uppercase">Not rated</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mb-12">
          <p className="mb-4 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
            Itineraries these came from &middot; {visibleTrips.length}
          </p>
          {visibleTrips.length === 0 ? (
            <p className="text-[14px] text-muted">Nothing public yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleTrips.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pr-2 pl-3.5">
                  <span className="text-[13px] text-ink-body">{t.name}</span>
                  <div className="flex items-center gap-1">
                    {!isSelf && <CopyTripButton tripId={t.id} />}
                    <Link
                      href={`/planner/trips/${t.id}`}
                      className="rounded-full border border-input-border bg-card px-3 py-1 text-[11.5px] text-ink hover:border-ink"
                    >
                      {isSelf ? "Open" : "See it"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {friends.length > 0 && (
          <div>
            <p className="mb-4 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">Friends</p>
            <div className="flex flex-col gap-2.5">
              {friends.map((f) => (
                <Link
                  key={f.id}
                  href={f.username ? `/planner/u/${f.username}` : "#"}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-input-border"
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] text-cream"
                    style={{ background: "#6E8C6A" }}
                  >
                    {initialsOf(f.name || f.username || "?")}
                  </div>
                  <span className="text-[14px] text-ink-body">
                    {f.name || (f.username ? `@${f.username}` : "Someone")}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
