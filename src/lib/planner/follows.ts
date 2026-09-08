import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** A friendship pair is stored with the smaller id first, so each pair has exactly one row regardless of who joined the trip first. */
function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Auto-friending: when someone joins a trip, they become friends with
 * every existing member of that trip — a real, mutual Friendship row, not
 * a pair of Follow rows (Follow stays one-directional and separate; you
 * can follow someone you've never traveled with, and traveling with
 * someone never subscribes you to their posts). Best-effort — a failure
 * here shouldn't block joining the trip itself. Doesn't re-friend a pair
 * that already has a row (e.g. an unfriend, once that exists, should stay
 * unfriended across future shared trips) — upsert with ignoreDuplicates
 * already gives us that for free.
 */
export async function autoFriendTripMembers(
  admin: SupabaseClient,
  tripId: string,
  newUserId: string
) {
  try {
    const { data: members } = await admin
      .from("planner_memberships")
      .select("user_id")
      .eq("trip_id", tripId)
      .neq("user_id", newUserId);

    const others = (members ?? []).map((m) => m.user_id as string);
    if (others.length === 0) return;

    const rows = others.map((otherId) => {
      const [user_a, user_b] = orderPair(newUserId, otherId);
      return { user_a, user_b, source: "trip" as const };
    });

    await admin.from("planner_friendships").upsert(rows, {
      onConflict: "user_a,user_b",
      ignoreDuplicates: true,
    });
  } catch {
    // Best-effort — friending can be missed without blocking the join.
  }
}

export interface FriendSummary {
  id: string;
  name: string | null;
  username: string | null;
  source: "trip" | "manual";
  sharedTripCount: number;
}

/** Every friendship this user is in, with how many trips they share with each friend — used by GET /me/friends and the profile's friends rail. */
export async function listFriends(admin: SupabaseClient, userId: string): Promise<FriendSummary[]> {
  const { data: rows } = await admin
    .from("planner_friendships")
    .select("user_a, user_b, source")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);

  const friendIds = (rows ?? []).map((r) => (r.user_a === userId ? r.user_b : r.user_a) as string);
  if (friendIds.length === 0) return [];

  const [{ data: friendUsers }, { data: myMemberships }, { data: theirMemberships }] = await Promise.all([
    admin.from("planner_users").select("id, name, username").in("id", friendIds),
    admin.from("planner_memberships").select("trip_id").eq("user_id", userId),
    admin.from("planner_memberships").select("trip_id, user_id").in("user_id", friendIds),
  ]);

  const myTripIds = new Set((myMemberships ?? []).map((m) => m.trip_id as string));
  const sharedCounts = new Map<string, number>();
  for (const m of theirMemberships ?? []) {
    if (myTripIds.has(m.trip_id as string)) {
      sharedCounts.set(m.user_id, (sharedCounts.get(m.user_id) ?? 0) + 1);
    }
  }

  return friendIds.map((id) => {
    const u = (friendUsers ?? []).find((f) => f.id === id);
    const row = (rows ?? []).find((r) => r.user_a === id || r.user_b === id);
    return {
      id,
      name: u?.name ?? null,
      username: u?.username ?? null,
      source: (row?.source as "trip" | "manual") ?? "trip",
      sharedTripCount: sharedCounts.get(id) ?? 0,
    };
  });
}

/** Slugifies a name/email into a URL-safe username, appending digits until unique. */
export async function ensureUsername(
  admin: SupabaseClient,
  userId: string,
  currentUsername: string | null,
  seed: string
): Promise<string> {
  if (currentUsername) return currentUsername;

  const base =
    seed
      .toLowerCase()
      .replace(/@.*/, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "friend";

  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    const { data: existing } = await admin
      .from("planner_users")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();
    if (!existing) {
      await admin.from("planner_users").update({ username: candidate }).eq("id", userId);
      return candidate;
    }
  }
  const fallback = `${base}${Date.now().toString(36)}`;
  await admin.from("planner_users").update({ username: fallback }).eq("id", userId);
  return fallback;
}
