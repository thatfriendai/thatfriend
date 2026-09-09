import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { listFriends } from "@/lib/planner/follows";
import { ExploreView, type FriendChip, type TripCard } from "./ExploreView";

function formatMonthYear(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { month: "short", year: "numeric" }).toUpperCase();
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

export default async function ExplorePage() {
  const viewer = await getPlannerUser();
  if (!viewer) redirect("/planner/login");

  const admin = createAdminClient();

  const friends = await listFriends(admin, viewer.id);
  const friendIds = friends.map((f) => f.id);
  const friendIdSet = new Set(friendIds);

  const fofLists = await Promise.all(friendIds.map((id) => listFriends(admin, id)));
  const fofMap = new Map<string, { id: string; name: string | null; username: string | null }>();
  for (const list of fofLists) {
    for (const f of list) {
      if (f.id === viewer.id || friendIdSet.has(f.id) || fofMap.has(f.id)) continue;
      fofMap.set(f.id, { id: f.id, name: f.name, username: f.username });
    }
  }
  const friendsOfFriends = [...fofMap.values()];
  const fofIds = friendsOfFriends.map((f) => f.id);
  const allNetworkIds = [...friendIds, ...fofIds];

  const [{ data: networkMemberships }, { data: savedRows }] = await Promise.all([
    allNetworkIds.length > 0
      ? admin
          .from("planner_memberships")
          .select("user_id, planner_trips(id, is_public)")
          .in("user_id", allNetworkIds)
      : Promise.resolve({ data: [] }),
    admin.from("planner_trip_saves").select("trip_id").eq("user_id", viewer.id),
  ]);

  const publicTripCountByUser = countBy(
    (networkMemberships ?? []).filter(
      (m) => (m.planner_trips as unknown as { is_public: boolean } | null)?.is_public
    ),
    (m) => m.user_id as string
  );

  const nameById = new Map<string, { name: string | null; username: string | null }>();
  for (const f of friends) nameById.set(f.id, { name: f.name, username: f.username });
  for (const f of friendsOfFriends) nameById.set(f.id, { name: f.name, username: f.username });

  function toChips(ids: string[]): FriendChip[] {
    return ids
      .map((id) => ({
        id,
        name: nameById.get(id)?.name || nameById.get(id)?.username || "Someone",
        username: nameById.get(id)?.username ?? null,
        tripCount: publicTripCountByUser.get(id) ?? 0,
      }))
      .sort((a, b) => b.tripCount - a.tripCount);
  }

  const friendChips = toChips(friendIds);
  const fofChips = toChips(fofIds);

  const savedTripIds = new Set((savedRows ?? []).map((r) => r.trip_id as string));

  async function fetchTripCards(ownerIds: string[]): Promise<TripCard[]> {
    if (ownerIds.length === 0) return [];
    const { data: trips } = await admin
      .from("planner_trips")
      .select("id, name, destination, start_date, created_by")
      .in("created_by", ownerIds)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(12);

    const tripIds = (trips ?? []).map((t) => t.id as string);
    const { data: placeRows } = tripIds.length
      ? await admin.from("planner_places").select("trip_id").in("trip_id", tripIds)
      : { data: [] };
    const placeCountByTrip = countBy(placeRows ?? [], (r) => r.trip_id as string);

    return (trips ?? []).map((t) => {
      const owner = nameById.get(t.created_by as string);
      return {
        id: t.id as string,
        name: t.name as string,
        destination: t.destination as string | null,
        monthYear: formatMonthYear(t.start_date as string | null),
        ownerName: owner?.name || owner?.username || "Someone",
        ownerUsername: owner?.username ?? null,
        placeCount: placeCountByTrip.get(t.id as string) ?? 0,
        saved: savedTripIds.has(t.id as string),
      };
    });
  }

  const [friendsTrips, fofTrips] = await Promise.all([fetchTripCards(friendIds), fetchTripCards(fofIds)]);

  return (
    <ExploreView
      friendChips={friendChips}
      fofChips={fofChips}
      friendsTrips={friendsTrips}
      fofTrips={fofTrips}
      tripsAndSavedCount={savedTripIds.size}
    />
  );
}
