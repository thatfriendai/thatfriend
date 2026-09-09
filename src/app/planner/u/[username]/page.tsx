import { notFound } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { listFriends } from "@/lib/planner/follows";
import { listVisits } from "@/lib/planner/ratingCapture";
import { ProfileView, type RatingCardData, type TripCardData, type VisitedPlaceRow } from "./ProfileView";

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

  const { data: memberships } = await admin
    .from("planner_memberships")
    .select("trip_id, planner_trips(id, name, destination, start_date, end_date, is_public)")
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
        } | null
    )
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const publicTrips = allTrips.filter((t) => t.is_public);
  const publicTripIds = publicTrips.map((t) => t.id);
  const privateTripCount = allTrips.length - publicTrips.length;
  const destinationByTripId = new Map(allTrips.map((t) => [t.id, t.destination]));

  const [{ data: placeRows }, { data: memberRows }] =
    publicTripIds.length > 0
      ? await Promise.all([
          admin.from("planner_places").select("trip_id").in("trip_id", publicTripIds),
          admin.from("planner_memberships").select("trip_id").in("trip_id", publicTripIds),
        ])
      : [{ data: [] }, { data: [] }];

  const placeCountByTrip = countBy(placeRows ?? [], (r) => r.trip_id as string);
  const memberCountByTrip = countBy(memberRows ?? [], (r) => r.trip_id as string);

  const today = new Date().toISOString().slice(0, 10);
  const nextTrip =
    publicTrips
      .filter((t) => t.start_date && (!t.end_date || t.end_date >= today))
      .sort((a, b) => (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999"))[0] ?? null;

  let canAskToJoinNextTrip = false;
  if (!isSelf && viewer && nextTrip) {
    const { data: viewerMembership } = await admin
      .from("planner_memberships")
      .select("trip_id")
      .eq("trip_id", nextTrip.id)
      .eq("user_id", viewer.id)
      .maybeSingle();
    canAskToJoinNextTrip = !viewerMembership;
  }

  const trips: TripCardData[] = publicTrips.map((t) => ({
    id: t.id,
    name: t.name,
    destination: t.destination,
    dateRange: formatDates(t.start_date, t.end_date),
    placeCount: placeCountByTrip.get(t.id) ?? 0,
    travellerCount: memberCountByTrip.get(t.id) ?? 0,
    canAskToJoin: canAskToJoinNextTrip && t.id === nextTrip?.id,
  }));

  const ratingScopeTripIds = isSelf ? allTrips.map((t) => t.id) : publicTripIds;
  const { data: ratingRows } =
    ratingScopeTripIds.length > 0
      ? await admin
          .from("planner_place_ratings")
          .select(
            "id, rating, body, created_at, trip_id, planner_places(id, name, kind, lat, lng, address, google_place_id, photo_url)"
          )
          .eq("user_id", profileUser.id)
          .in("trip_id", ratingScopeTripIds)
          .order("rating", { ascending: false })
      : { data: [] };

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
    for (const tripId of endedTripIds) {
      const tripVisits = await listVisits(admin, tripId);
      for (const v of tripVisits) {
        if (ratedPlaceIds.has(v.id)) continue;
        unratedVisitCount++;
        firstUnratedTripId ??= tripId;
        if (feed.length === 0) {
          visits.push({ id: v.id, name: v.name, tripName: destinationByTripId.get(tripId) ?? "a trip", dayLabel: v.dayLabel });
        }
      }
    }
  }

  let recentViewerCount = 0;
  if (isSelf) {
    const thirtyDaysAgo = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: viewRows } = await admin
      .from("planner_profile_views")
      .select("viewer_id")
      .eq("profile_user_id", profileUser.id)
      .gte("viewed_at", thirtyDaysAgo);
    recentViewerCount = new Set((viewRows ?? []).map((r) => r.viewer_id as string)).size;
  } else if (viewer) {
    // Best-effort, non-blocking — a failed insert shouldn't break the page.
    void admin
      .from("planner_profile_views")
      .insert({ profile_user_id: profileUser.id, viewer_id: viewer.id })
      .then(undefined, () => {});
  }

  const { count: followersCount } = await admin
    .from("planner_follows")
    .select("*", { count: "exact", head: true })
    .eq("followee_id", profileUser.id);

  let isFollowing = false;
  let mutualFriendsCount = 0;

  if (viewer && !isSelf) {
    const [{ data: followRow }, viewerFriends, profileFriends] = await Promise.all([
      admin
        .from("planner_follows")
        .select("follower_id")
        .eq("follower_id", viewer.id)
        .eq("followee_id", profileUser.id)
        .maybeSingle(),
      listFriends(admin, viewer.id),
      listFriends(admin, profileUser.id),
    ]);
    isFollowing = Boolean(followRow);
    const viewerFriendIds = new Set(viewerFriends.map((f) => f.id));
    mutualFriendsCount = profileFriends.filter((f) => viewerFriendIds.has(f.id)).length;
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
      followersCount={followersCount ?? 0}
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
    />
  );
}
