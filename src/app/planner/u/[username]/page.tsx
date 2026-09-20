import { notFound } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { listFriends } from "@/lib/planner/follows";
import { buildPeopleLists } from "@/lib/planner/followingLists";
import { listVisits } from "@/lib/planner/ratingCapture";
import { buildTravelMap, countrySet } from "@/lib/planner/travelMap";
import { listBackfilledCountries } from "@/lib/planner/backfillCountries";
import { ProfileView, type RatingCardData, type TripCardData, type VisitedPlaceRow } from "./ProfileView";
import type { ProfilePersonRow } from "./PeoplePanel";
import type { LiveTrip } from "./ProfileMap";

function formatDates(start: string | null, end: string | null) {
  if (!start) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(start + "T00:00:00").toLocaleDateString(undefined, opts).toUpperCase();
  if (!end) return s;
  const e = new Date(end + "T00:00:00").toLocaleDateString(undefined, opts).toUpperCase();
  return `${s}–${e}`;
}

function formatMonthYear(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", year: "numeric" }).toUpperCase();
}

/** Non-uppercase month/year ("Sep 2026") for the map's trip-summary lines, which read as prose rather than a mono label. */
function monthYearLabel(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function liveDayLabel(start: string, end: string, todayStr: string) {
  const DAY = 86400000;
  const s = new Date(start + "T00:00:00").getTime();
  const e = new Date(end + "T00:00:00").getTime();
  const t = new Date(todayStr + "T00:00:00").getTime();
  const totalDays = Math.round((e - s) / DAY) + 1;
  const dayIndex = Math.min(totalDays, Math.max(1, Math.round((t - s) / DAY) + 1));
  return `Day ${dayIndex} of ${totalDays}`;
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getPlannerUser();
  const admin = createAdminClient();

  const { data: profileUser } = await admin
    .from("planner_users")
    .select("id, name, username, tagline, location, avatar_url, is_public")
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

  const thirtyDaysAgo = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Phase 1: everything here depends only on profileUser.id/viewer.id, not
  // on each other — one round trip instead of several sequential ones.
  const [{ data: memberships }, people, backfilledCountries, friendsResult, viewerCountResult] = await Promise.all([
    admin
      .from("planner_memberships")
      .select("trip_id, planner_trips(id, name, destination, start_date, end_date, is_public)")
      .eq("user_id", profileUser.id),
    buildPeopleLists(admin, profileUser.id),
    listBackfilledCountries(admin, profileUser.id),
    viewer && !isSelf
      ? Promise.all([
          admin
            .from("planner_follows")
            .select("follower_id")
            .eq("follower_id", viewer.id)
            .eq("followee_id", profileUser.id)
            .maybeSingle(),
          listFriends(admin, viewer.id),
          listFriends(admin, profileUser.id),
        ])
      : Promise.resolve(null),
    isSelf
      ? admin
          .from("planner_profile_views")
          .select("viewer_id")
          .eq("profile_user_id", profileUser.id)
          .gte("viewed_at", thirtyDaysAgo)
      : Promise.resolve(null),
  ]);

  let isFollowing = false;
  let mutualFriendsCount = 0;
  if (friendsResult) {
    const [{ data: followRow }, viewerFriends, profileFriends] = friendsResult;
    isFollowing = Boolean(followRow);
    const viewerFriendIds = new Set(viewerFriends.map((f) => f.id));
    mutualFriendsCount = profileFriends.filter((f) => viewerFriendIds.has(f.id)).length;
  } else if (viewer) {
    // Best-effort, non-blocking — a failed insert shouldn't break the page.
    void admin
      .from("planner_profile_views")
      .insert({ profile_user_id: profileUser.id, viewer_id: viewer.id })
      .then(undefined, () => {});
  }

  const recentViewerCount = viewerCountResult
    ? new Set((viewerCountResult.data ?? []).map((r) => r.viewer_id as string)).size
    : 0;

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
        } | null
    )
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const publicTrips = allTrips.filter((t) => t.is_public);
  const publicTripIds = publicTrips.map((t) => t.id);
  const privateTripCount = allTrips.length - publicTrips.length;
  const destinationByTripId = new Map(allTrips.map((t) => [t.id, t.destination]));
  const tripInfoById = new Map(allTrips.map((t) => [t.id, { title: t.name, monthYear: monthYearLabel(t.start_date) }]));

  const today = new Date().toISOString().slice(0, 10);
  const nextTrip =
    publicTrips
      .filter((t) => t.start_date && (!t.end_date || t.end_date >= today))
      .sort((a, b) => (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999"))[0] ?? null;
  const liveTrip =
    publicTrips.find((t) => t.start_date && t.end_date && t.start_date <= today && today <= t.end_date) ?? null;
  const ratingScopeTripIds = isSelf ? allTrips.map((t) => t.id) : publicTripIds;

  const peopleIds = [...new Set([...people.followers.map((p) => p.id), ...people.following.map((p) => p.id)])];

  // Phase 2: none of these depend on each other or on anything besides
  // phase 1's results, so they run as one round trip too.
  const [
    [{ data: placeRows }, { data: memberRows }],
    viewerMembershipResult,
    { data: ratingRows },
    viewerFollowsPeopleResult,
    viewerOwnRatingResult,
  ] = await Promise.all([
    publicTripIds.length > 0
      ? Promise.all([
          admin.from("planner_places").select("trip_id, lat, lng").in("trip_id", publicTripIds),
          admin.from("planner_memberships").select("trip_id").in("trip_id", publicTripIds),
        ])
      : Promise.resolve<
          [{ data: { trip_id: string; lat: number | null; lng: number | null }[] }, { data: { trip_id: string }[] }]
        >([{ data: [] }, { data: [] }]),
    !isSelf && viewer && nextTrip
      ? admin.from("planner_memberships").select("trip_id").eq("trip_id", nextTrip.id).eq("user_id", viewer.id).maybeSingle()
      : Promise.resolve(null),
    ratingScopeTripIds.length > 0
      ? admin
          .from("planner_place_ratings")
          .select(
            "id, rating, body, created_at, trip_id, planner_places(id, name, kind, lat, lng, address, google_place_id, photo_url)"
          )
          .eq("user_id", profileUser.id)
          .in("trip_id", ratingScopeTripIds)
          .order("rating", { ascending: false })
      : Promise.resolve({ data: [] }),
    !isSelf && viewer && peopleIds.length > 0
      ? admin.from("planner_follows").select("followee_id").eq("follower_id", viewer.id).in("followee_id", peopleIds)
      : Promise.resolve({ data: [] }),
    !isSelf && viewer
      ? admin.from("planner_place_ratings").select("planner_places(address)").eq("user_id", viewer.id)
      : Promise.resolve({ data: [] }),
  ]);

  const placeCountByTrip = countBy(placeRows ?? [], (r) => r.trip_id as string);
  const memberCountByTrip = countBy(memberRows ?? [], (r) => r.trip_id as string);
  const canAskToJoinNextTrip = !isSelf && viewer && nextTrip ? !viewerMembershipResult?.data : false;

  const livePinByTrip = new Map<string, { lat: number; lng: number }>();
  for (const p of placeRows ?? []) {
    const tripId = p.trip_id as string;
    if (livePinByTrip.has(tripId)) continue;
    if (typeof p.lat === "number" && typeof p.lng === "number") livePinByTrip.set(tripId, { lat: p.lat, lng: p.lng });
  }
  const livePin = liveTrip ? livePinByTrip.get(liveTrip.id) : null;
  const live: LiveTrip | null =
    liveTrip && livePin && liveTrip.start_date && liveTrip.end_date
      ? {
          city: liveTrip.destination || liveTrip.name,
          dayLabel: liveDayLabel(liveTrip.start_date, liveTrip.end_date, today),
          lat: livePin.lat,
          lng: livePin.lng,
        }
      : null;

  const viewerFollowsPeopleSet = isSelf
    ? new Set(people.following.map((f) => f.id))
    : new Set((viewerFollowsPeopleResult.data ?? []).map((r) => r.followee_id as string));

  const feed: RatingCardData[] = (ratingRows ?? [])
    .map((r) => {
      const place = r.planner_places as unknown as {
        id: string;
        name: string;
        kind: string;
        lat: number | null;
        lng: number | null;
        address: string | null;
        google_place_id: string | null;
        photo_url: string | null;
      } | null;
      if (!place) return null;
      return {
        id: r.id as string,
        placeId: place.id,
        tripId: r.trip_id as string,
        tripName: tripInfoById.get(r.trip_id as string)?.title ?? "a trip",
        name: place.name,
        kind: place.kind,
        rating: r.rating as number,
        body: r.body as string | null,
        location: destinationByTripId.get(r.trip_id as string) ?? null,
        monthYear: r.created_at ? formatMonthYear(r.created_at as string) : null,
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        googlePlaceId: place.google_place_id,
        photoUrl: place.photo_url,
      };
    })
    .filter((r): r is RatingCardData => r !== null);

  const herTravelMap = buildTravelMap(
    feed.map((r) => ({
      tripId: r.tripId,
      tripTitle: r.tripName,
      tripMonthYear: tripInfoById.get(r.tripId)?.monthYear ?? null,
      name: r.name,
      kind: r.kind,
      rating: r.rating,
      address: r.address,
      fallbackCity: r.location,
    }))
  );

  // Real coordinates for the map's "cities with rated places" pin layer —
  // one pin per rated place, not deduplicated by city, since a handful of
  // overlapping pins in the same city reads fine at this zoom level.
  const pins = feed
    .filter((r): r is RatingCardData & { lat: number; lng: number } => r.lat !== null && r.lng !== null)
    .map((r) => ({ lat: r.lat, lng: r.lng }));

  const mine = !isSelf && viewer
    ? {
        codes: [
          ...countrySet(
            (viewerOwnRatingResult.data ?? []).map(
              (r) => (r.planner_places as unknown as { address: string | null } | null)?.address ?? null
            )
          ),
        ],
      }
    : null;

  // Unrated visits feed the zero-rating fallback list (any viewer, only
  // when there's nothing rated yet) and the owner-only "rate your places"
  // nudge (isSelf, regardless of feed state — you can have rated places
  // from one trip and still have unrated ones from a more recent trip).
  const visits: VisitedPlaceRow[] = [];
  let unratedVisitCount = 0;
  let firstUnratedTripId: string | null = null;
  if (feed.length === 0 || isSelf) {
    const ratedPlaceIds = new Set(feed.map((r) => r.placeId));
    const endedTripIds = allTrips
      .filter((t) => ratingScopeTripIds.includes(t.id) && t.end_date && t.end_date < today)
      .map((t) => t.id);
    // Fetched for every ended trip at once instead of one at a time — the
    // per-trip bookkeeping below still runs in endedTripIds order, so
    // "first unrated trip" means the same thing it always did.
    const visitsByTrip = await Promise.all(endedTripIds.map((tripId) => listVisits(admin, tripId)));
    endedTripIds.forEach((tripId, i) => {
      for (const v of visitsByTrip[i]) {
        if (ratedPlaceIds.has(v.id)) continue;
        unratedVisitCount++;
        firstUnratedTripId ??= tripId;
        if (feed.length === 0) {
          visits.push({ id: v.id, name: v.name, tripName: destinationByTripId.get(tripId) ?? "a trip", dayLabel: v.dayLabel });
        }
      }
    });
  }

  const feedByTrip = new Map<string, RatingCardData[]>();
  for (const r of feed) {
    const list = feedByTrip.get(r.tripId) ?? [];
    list.push(r);
    feedByTrip.set(r.tripId, list);
  }

  const trips: TripCardData[] = publicTrips.map((t) => {
    const rated = feedByTrip.get(t.id) ?? [];
    return {
      id: t.id,
      name: t.name,
      destination: t.destination,
      dateRange: formatDates(t.start_date, t.end_date),
      placeCount: placeCountByTrip.get(t.id) ?? 0,
      travellerCount: memberCountByTrip.get(t.id) ?? 0,
      canAskToJoin: canAskToJoinNextTrip && t.id === nextTrip?.id,
      live: liveTrip?.id === t.id,
      liveLabel: liveTrip?.id === t.id ? live?.dayLabel ?? null : null,
      ratedTotal: rated.length,
      rated: rated.slice(0, 3).map((r) => ({ name: r.name, kind: r.kind, rating: r.rating })),
    };
  });

  function toPersonRow(p: { id: string; name: string; username: string | null; publicTripCount: number; mutual: boolean }): ProfilePersonRow {
    return { ...p, viewerFollowsInitial: viewerFollowsPeopleSet.has(p.id) };
  }

  const label = profileUser.name || `@${profileUser.username}`;
  const firstName = (profileUser.name || profileUser.username || "they").split(" ")[0];

  return (
    <ProfileView
      username={username}
      ownerId={profileUser.id}
      label={label}
      firstName={firstName}
      tagline={profileUser.tagline}
      location={profileUser.location}
      avatarUrl={profileUser.avatar_url}
      isSelf={isSelf}
      publicTripCount={publicTrips.length}
      ratedCount={feed.length}
      followersCount={people.followers.length}
      followingCount={people.following.length}
      mutualFriendsCount={mutualFriendsCount}
      isFollowingInitial={isFollowing}
      viewerSignedIn={Boolean(viewer)}
      feed={feed}
      visits={visits}
      unratedVisitCount={unratedVisitCount}
      firstUnratedTripId={firstUnratedTripId}
      recentViewerCount={recentViewerCount}
      trips={trips}
      privateTripCount={privateTripCount}
      followers={people.followers.map(toPersonRow)}
      following={people.following.map(toPersonRow)}
      viewerCanFollow={Boolean(viewer)}
      herTravelMap={herTravelMap}
      mineTravelMap={mine}
      liveTrip={live}
      backfilledCountries={backfilledCountries}
      mapPins={pins}
    />
  );
}
