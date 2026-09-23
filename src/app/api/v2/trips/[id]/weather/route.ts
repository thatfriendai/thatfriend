import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { forecastForDays } from "@/lib/planner/weather";
import { inTripRange } from "@/lib/planner/days";

/** { forecast: { "2026-09-19": "24° sunny · sunset 19:32", … } } — fetched by the itinerary after it renders. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: membership }, { data: trip }, { data: days }] = await Promise.all([
    admin.from("planner_memberships").select("trip_id").eq("trip_id", tripId).eq("user_id", user.id).maybeSingle(),
    admin.from("planner_trips").select("destination, start_date, end_date").eq("id", tripId).maybeSingle(),
    admin.from("planner_days").select("date, city").eq("trip_id", tripId),
  ]);
  if (!membership || !trip) return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });

  return NextResponse.json({ forecast: await forecastForDays(
      trip.start_date && trip.end_date ? inTripRange(days ?? [], trip.start_date, trip.end_date) : [],
      trip.destination
    ) });
}
