import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { listFriends } from "@/lib/planner/follows";
import { getNavCounts } from "@/lib/planner/navCounts";
import { signOut } from "@/app/planner/actions";
import { GUIDES } from "@/lib/planner/guides";
import { ExploreView, type TripCard } from "./ExploreView";

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

  // None of these three depend on each other — savedRows and navCounts
  // only need viewer.id, so there's no reason to make them wait behind the
  // friends-of-friends expansion below, which used to run them dead last.
  const [friends, { data: savedRows }, { tripsCount }] = await Promise.all([
    listFriends(admin, viewer.id),
    admin.from("planner_trip_saves").select("trip_id").eq("user_id", viewer.id),
    getNavCounts(admin, viewer.id),
  ]);
  const friendIds = friends.map((f) => f.id);
  const friendIdSet = new Set(friendIds);

  const [fofLists, { data: interactionRows }] = await Promise.all([
    Promise.all(friendIds.map((id) => listFriends(admin, id))),
    friendIds.length
      ? admin
          .from("planner_guide_interactions")
          .select("guide_id, user_id, kind")
          .in(
            "guide_id",
            GUIDES.map((g) => g.id)
          )
          .in("user_id", friendIds)
      : Promise.resolve({ data: [] as { guide_id: string; user_id: string; kind: string }[] }),
  ]);
  const fofMap = new Map<string, { id: string; name: string | null; username: string | null }>();
  for (const list of fofLists) {
    for (const f of list) {
      if (f.id === viewer.id || friendIdSet.has(f.id) || fofMap.has(f.id)) continue;
      fofMap.set(f.id, { id: f.id, name: f.name, username: f.username });
    }
  }
  const friendsOfFriends = [...fofMap.values()];
  const fofIds = friendsOfFriends.map((f) => f.id);

  const nameById = new Map<string, { name: string | null; username: string | null }>();
  for (const f of friends) nameById.set(f.id, { name: f.name, username: f.username });
  for (const f of friendsOfFriends) nameById.set(f.id, { name: f.name, username: f.username });

  const savedTripIds = new Set((savedRows ?? []).map((r) => r.trip_id as string));

  // "Jonah opened this" / "Nobody in your circle has opened this yet" —
  // scoped to direct friends only, never friends of friends, matching
  // "your circle" in the copy.
  const interactionsByGuide = new Map<string, { user_id: string; kind: string }[]>();
  for (const row of interactionRows ?? []) {
    const list = interactionsByGuide.get(row.guide_id as string) ?? [];
    list.push({ user_id: row.user_id as string, kind: row.kind as string });
    interactionsByGuide.set(row.guide_id as string, list);
  }
  const guideFriendLines: Record<string, string> = {};
  for (const guide of GUIDES) {
    const rows = interactionsByGuide.get(guide.id) ?? [];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    if (userIds.length === 0) {
      guideFriendLines[guide.id] = "Nobody in your circle has opened this yet.";
      continue;
    }
    const verb = rows.some((r) => r.kind === "clone") ? "copied" : "opened";
    if (userIds.length === 1) {
      const who = nameById.get(userIds[0]);
      const firstName = (who?.name || who?.username || "A friend").split(" ")[0];
      guideFriendLines[guide.id] = `${firstName} ${verb} this.`;
    } else {
      guideFriendLines[guide.id] = `${userIds.length} friends have ${verb} this.`;
    }
  }

  async function fetchTripCards(ownerIds: string[]): Promise<TripCard[]> {
    if (ownerIds.length === 0) return [];
    const { data: trips } = await admin
      .from("planner_trips")
      .select("id, name, destination, start_date, created_by, trip_type")
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
        tripType: t.trip_type as string | null,
      };
    });
  }

  // Unlike fetchTripCards above (scoped to a friend/FoF owner list), the
  // "Trip type" tab browses every public trip on the platform — per the
  // design handoff, "Every public trip, grouped by what kind of trip it
  // was," independent of who you follow. Owners here can fall outside the
  // friend network entirely, so their names come from a fresh lookup
  // rather than the network-scoped nameById map above.
  async function fetchPublicTrips(): Promise<TripCard[]> {
    const { data: trips } = await admin
      .from("planner_trips")
      .select("id, name, destination, start_date, created_by, trip_type")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(60);
    if (!trips || trips.length === 0) return [];

    const ownerIds = [...new Set(trips.map((t) => t.created_by as string))];
    const tripIds = trips.map((t) => t.id as string);
    const [{ data: ownerRows }, { data: placeRows }] = await Promise.all([
      admin.from("planner_users").select("id, name, username").in("id", ownerIds),
      admin.from("planner_places").select("trip_id").in("trip_id", tripIds),
    ]);
    const ownerById = new Map((ownerRows ?? []).map((o) => [o.id as string, o]));
    const placeCountByTrip = countBy(placeRows ?? [], (r) => r.trip_id as string);

    return trips.map((t) => {
      const owner = ownerById.get(t.created_by as string);
      return {
        id: t.id as string,
        name: t.name as string,
        destination: t.destination as string | null,
        monthYear: formatMonthYear(t.start_date as string | null),
        ownerName: owner?.name || owner?.username || "Someone",
        ownerUsername: (owner?.username as string | null) ?? null,
        placeCount: placeCountByTrip.get(t.id as string) ?? 0,
        saved: savedTripIds.has(t.id as string),
        tripType: t.trip_type as string | null,
      };
    });
  }

  const [friendsTrips, fofTrips, publicTrips] = await Promise.all([
    fetchTripCards(friendIds),
    fetchTripCards(fofIds),
    fetchPublicTrips(),
  ]);

  return (
    <Suspense fallback={null}>
      <ExploreView
        friendsTrips={friendsTrips}
        fofTrips={fofTrips}
        publicTrips={publicTrips}
        guideFriendLines={guideFriendLines}
        savedCount={savedTripIds.size}
        navInitial={initialsOf(viewer.name || viewer.email || "?")}
        navUsername={viewer.username}
        navTripsCount={tripsCount}
        signOutAction={signOut}
      />
    </Suspense>
  );
}
