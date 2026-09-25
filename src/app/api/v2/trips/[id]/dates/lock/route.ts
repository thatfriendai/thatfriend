import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { notifyTrip } from "@/lib/planner/notify";
import { formatDateRange, tripRangeError } from "@/lib/planner/calendarDate";
import { earliestProposableDate } from "@/lib/planner/dates";

// The group text's dates: "Oct 16–18", or "Oct 24" for a day trip (it used
// to read "Oct 24–Oct 24").
function shortDates(start: string, end: string) {
  return formatDateRange(start, end);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }
  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only the trip owner can lock dates." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const rangeError = tripRangeError(body.start_date, body.end_date);
  if (rangeError) return NextResponse.json({ error: rangeError }, { status: 400 });
  const startDate: string = body.start_date;
  const endDate: string = body.end_date;
  // Same one day of slack as the proposal itself (see earliestProposableDate).
  // Keeping the current start is always fine — that's extending or trimming
  // the end of a trip that's already underway.
  const { data: current } = await admin.from("planner_trips").select("start_date").eq("id", tripId).maybeSingle();
  if (startDate < earliestProposableDate() && startDate !== current?.start_date) {
    return NextResponse.json({ error: "That start date has already passed — pick dates from today on." }, { status: 400 });
  }

  const { data: days } = await admin
    .from("planner_days")
    .select("id, date")
    .eq("trip_id", tripId);
  const outOfRangeDayIds = (days ?? [])
    .filter((d) => d.date < startDate || d.date > endDate)
    .map((d) => d.id);

  let warning: string | null = null;
  if (outOfRangeDayIds.length > 0) {
    const { count } = await admin
      .from("planner_itinerary_items")
      .select("id", { count: "exact", head: true })
      .in("day_id", outOfRangeDayIds);
    if (count && count > 0) {
      warning = `${count} planned item${count === 1 ? "" : "s"} fall outside the new dates and will stay on the plan alongside the new dates.`;
    }
  }

  const { data: trip, error } = await admin
    .from("planner_trips")
    .update({
      start_date: startDate,
      end_date: endDate,
      dates_locked_at: new Date().toISOString(),
      dates_flagged_by: null,
      dates_flagged_at: null,
      dates_flag_note: null,
    })
    .eq("id", tripId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notifyTrip(admin, trip, `"${trip.name}" dates are set: ${shortDates(startDate, endDate)}.`);

  return NextResponse.json({ trip, warning });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }
  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only the trip owner can unlock dates." }, { status: 403 });
  }

  const { data: trip, error } = await admin
    .from("planner_trips")
    .update({ dates_locked_at: null })
    .eq("id", tripId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ trip });
}
