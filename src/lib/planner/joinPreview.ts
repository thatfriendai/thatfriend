import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { activeMembersOf } from "./membership";

export interface JoinPreviewData {
  tripId: string;
  tripName: string;
  destination: string | null;
  dateRange: string | null;
  ownerName: string;
  memberNames: string[];
}

/** Everything the "Join <trip>" page shows above the button, from one trip id. */
export async function loadJoinPreview(admin: SupabaseClient, tripId: string): Promise<JoinPreviewData | null> {
  const [{ data: trip }, members] = await Promise.all([
    admin.from("planner_trips").select("id, name, destination, start_date, end_date, created_by").eq("id", tripId).maybeSingle(),
    // Active members only — someone who left or was removed isn't "going",
    // and activeMembersOf carries the FK hint the removed_by column made
    // necessary (a bare planner_users embed now fails with PGRST201).
    activeMembersOf(admin, tripId),
  ]);
  if (!trip) return null;

  const { data: owner } = await admin.from("planner_users").select("name, email").eq("id", trip.created_by).maybeSingle();
  const ownerName = owner?.name?.split(" ")[0] || owner?.email?.split("@")[0] || "Someone";

  const memberNames = members
    .map((m) => m.name?.split(" ")[0] || m.email?.split("@")[0] || null)
    .filter((n): n is string => Boolean(n));

  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${new Date(trip.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
      : trip.start_date
        ? new Date(trip.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })
        : null;

  return { tripId: trip.id, tripName: trip.name, destination: trip.destination, dateRange, ownerName, memberNames };
}
