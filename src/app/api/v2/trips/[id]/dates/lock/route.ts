import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }
  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only the trip owner can lock dates." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const startDate = typeof body.start_date === "string" ? body.start_date : null;
  const endDate = typeof body.end_date === "string" ? body.end_date : null;
  if (!startDate || !endDate || !DATE_RE.test(startDate) || !DATE_RE.test(endDate) || startDate > endDate) {
    return NextResponse.json({ error: "start_date and end_date are required and must be a valid range." }, { status: 400 });
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
      warning = `${count} planned item${count === 1 ? "" : "s"} fall outside the new dates and will stay on the plan, just off the active range.`;
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
