import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { listFriends } from "@/lib/planner/follows";
import { FollowingView, type PersonRow } from "./FollowingView";

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

export default async function FollowingPage() {
  const viewer = await getPlannerUser();
  if (!viewer) redirect("/planner/login");

  const admin = createAdminClient();

  const [{ data: followingRows }, { data: followerRows }, { data: viewerMemberships }, { data: tripSaveRows }] = await Promise.all([
    admin.from("planner_follows").select("followee_id").eq("follower_id", viewer.id),
    admin.from("planner_follows").select("follower_id").eq("followee_id", viewer.id),
    admin.from("planner_memberships").select("trip_id").eq("user_id", viewer.id),
    admin.from("planner_trip_saves").select("trip_id").eq("user_id", viewer.id),
  ]);

  const followingIds = (followingRows ?? []).map((r) => r.followee_id as string);
  const followingSet = new Set(followingIds);
  const followerIds = (followerRows ?? []).map((r) => r.follower_id as string);
  const startedFollowingIds = followerIds.filter((id) => !followingSet.has(id));
  const viewerTripIds = new Set((viewerMemberships ?? []).map((m) => m.trip_id as string));

  const friends = await listFriends(admin, viewer.id);
  const friendIds = friends.map((f) => f.id);
  const travelledWithIds = friendIds.filter((id) => !followingSet.has(id));

  const allIds = [...new Set([...followingIds, ...startedFollowingIds, ...travelledWithIds])];

  const [{ data: userRows }, { data: memberRows }] = await Promise.all([
    allIds.length ? admin.from("planner_users").select("id, name, username").in("id", allIds) : Promise.resolve({ data: [] }),
    allIds.length
      ? admin.from("planner_memberships").select("user_id, trip_id, planner_trips(id, name, destination, is_public)").in("user_id", allIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nameById = new Map((userRows ?? []).map((u) => [u.id as string, { name: u.name as string | null, username: u.username as string | null }]));

  const publicTripCountByUser = countBy(
    (memberRows ?? []).filter((m) => (m.planner_trips as unknown as { is_public: boolean } | null)?.is_public),
    (m) => m.user_id as string
  );

  const tripIdsByUser = new Map<string, string[]>();
  const tripInfoById = new Map<string, { name: string; destination: string | null }>();
  for (const m of memberRows ?? []) {
    const uid = m.user_id as string;
    const trip = m.planner_trips as unknown as { id: string; name: string; destination: string | null } | null;
    if (!trip) continue;
    tripInfoById.set(trip.id, { name: trip.name, destination: trip.destination });
    const list = tripIdsByUser.get(uid) ?? [];
    list.push(trip.id);
    tripIdsByUser.set(uid, list);
  }

  const friendsByUser = new Map<string, Set<string>>();
  for (const id of [...startedFollowingIds, ...travelledWithIds]) {
    const theirFriends = await listFriends(admin, id);
    friendsByUser.set(id, new Set(theirFriends.map((f) => f.id)));
  }
  const myFriendSet = new Set(friendIds);

  function mutualCount(otherId: string) {
    const theirs = friendsByUser.get(otherId);
    if (!theirs) return 0;
    let count = 0;
    for (const id of myFriendSet) if (theirs.has(id)) count++;
    return count;
  }

  function metOn(otherId: string): string | null {
    const theirTrips = new Set(tripIdsByUser.get(otherId) ?? []);
    for (const tripId of viewerTripIds) {
      if (theirTrips.has(tripId)) {
        const info = tripInfoById.get(tripId);
        if (info) return info.destination || info.name;
      }
    }
    return null;
  }

  const followerIdSet = new Set(followerIds);

  function toPerson(id: string): PersonRow {
    const u = nameById.get(id);
    return {
      id,
      name: u?.name || u?.username || "Someone",
      username: u?.username ?? null,
      publicTripCount: publicTripCountByUser.get(id) ?? 0,
      mutualFriendCount: mutualCount(id),
      metOn: metOn(id),
      followsYouBack: followerIdSet.has(id),
    };
  }

  const startedFollowingYou = startedFollowingIds.map(toPerson);
  const following = followingIds.map(toPerson).sort((a, b) => b.publicTripCount - a.publicTripCount);
  const travelledWith = travelledWithIds.map(toPerson);

  return (
    <FollowingView
      startedFollowingYou={startedFollowingYou}
      following={following}
      followerCount={followerIds.length}
      travelledWith={travelledWith}
      viewerUsername={viewer.username}
      tripsAndSavedCount={(tripSaveRows ?? []).length}
    />
  );
}
