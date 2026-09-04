import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Auto-friending: when someone joins a trip, they and every existing
 * member of that trip follow each other, so the friends rail is
 * populated without anyone doing work. Best-effort — a failure here
 * shouldn't block joining the trip itself.
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

    const rows = others.flatMap((otherId) => [
      { follower_id: newUserId, followee_id: otherId },
      { follower_id: otherId, followee_id: newUserId },
    ]);

    await admin.from("planner_follows").upsert(rows, {
      onConflict: "follower_id,followee_id",
      ignoreDuplicates: true,
    });
  } catch {
    // Best-effort — friending can be missed without blocking the join.
  }
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
