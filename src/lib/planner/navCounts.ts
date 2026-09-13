import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Trips = memberships in a non-archived trip — the badge count shown next to "Trips" in the top nav. */
export async function getNavCounts(admin: SupabaseClient, userId: string): Promise<{ tripsCount: number }> {
  const { count: tripsCount } = await admin
    .from("planner_memberships")
    .select("trip_id", { count: "exact", head: true })
    .eq("user_id", userId);
  return { tripsCount: tripsCount ?? 0 };
}
