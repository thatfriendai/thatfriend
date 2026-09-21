import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  const [{ data: trip }, { data: members }] = await Promise.all([
    admin.from("planner_trips").select("id, name, destination, start_date, end_date, created_by").eq("id", tripId).maybeSingle(),
    admin.from("planner_memberships").select("user_id, planner_users(name, email)").eq("trip_id", tripId),
  ]);
  if (!trip) return null;

  const { data: owner } = await admin.from("planner_users").select("name, email").eq("id", trip.created_by).maybeSingle();
  const ownerName = owner?.name?.split(" ")[0] || owner?.email?.split("@")[0] || "Someone";

  const memberNames = (members ?? [])
    .map((m) => {
      const u = m.planner_users as unknown as { name: string | null; email: string | null } | null;
      return u?.name?.split(" ")[0] || u?.email?.split("@")[0] || null;
    })
    .filter((n): n is string => Boolean(n));

  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${new Date(trip.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
      : trip.start_date
        ? new Date(trip.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })
        : null;

  return { tripId: trip.id, tripName: trip.name, destination: trip.destination, dateRange, ownerName, memberNames };
}
