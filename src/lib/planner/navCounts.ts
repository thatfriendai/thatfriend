import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Trips = memberships in a non-archived trip; Saved = bookmarked trips + saved places — the two badge counts shown in the top nav. */
export async function getNavCounts(admin: SupabaseClient, userId: string): Promise<{ tripsCount: number; savedCount: number }> {
  const [{ count: tripsCount }, { count: savedPlacesCount }, { count: savedTripsCount }] = await Promise.all([
    admin.from("planner_memberships").select("trip_id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("planner_saved_places").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("planner_trip_saves").select("trip_id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  return { tripsCount: tripsCount ?? 0, savedCount: (savedPlacesCount ?? 0) + (savedTripsCount ?? 0) };
}
