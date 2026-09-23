import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { generateToken } from "@/lib/planner/tokens";
import { sanitizeMarkDates, todayIn, tripRangeError } from "@/lib/planner/calendarDate";
import { TRIP_TYPES, type TripPrivacy } from "@/lib/supabase/planner-types";

/** Long enough for any real trip name; short enough that it can't break every header and SMS it appears in. */
const MAX_NAME_LENGTH = 120;

export async function POST(request: Request) {
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Trip name is required." }, { status: 400 });
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `Trip names can be at most ${MAX_NAME_LENGTH} characters.` }, { status: 400 });
  }

  // Dates are optional at creation (the group can find them later), but if
  // either is given, both must be and they must make a real trip.
  const startDate = body.start_date || null;
  const endDate = body.end_date || null;
  if (startDate || endDate) {
    const rangeError = tripRangeError(startDate, endDate);
    if (rangeError) return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  const tripType = typeof body.trip_type === "string" ? body.trip_type : "";
  if (!TRIP_TYPES.includes(tripType as (typeof TRIP_TYPES)[number])) {
    return NextResponse.json({ error: "Trip type is required." }, { status: 400 });
  }

  const privacy: TripPrivacy = body.privacy === "open" ? "open" : "private";

  const admin = createAdminClient();

  const { data: trip, error } = await admin
    .from("planner_trips")
    .insert({
      name,
      destination: body.destination || null,
      start_date: startDate,
      end_date: endDate,
      occasion: body.occasion || null,
      trip_type: tripType,
      budget_band: body.budget_band || null,
      privacy,
      created_by: user.id,
      is_public: user.default_trip_public,
    })
    .select("*")
    .single();

  if (error || !trip) {
    return NextResponse.json({ error: error?.message ?? "Could not create trip." }, { status: 500 });
  }

  await admin
    .from("planner_memberships")
    .insert({ trip_id: trip.id, user_id: user.id, role: "owner" });

  // Same rules as the availability route; an oversized list is just dropped.
  const availableDates = sanitizeMarkDates(body.available_dates, todayIn()) ?? [];
  if (availableDates.length > 0) {
    await admin.from("planner_availability_marks").insert(
      availableDates.map((date) => ({ trip_id: trip.id, user_id: user.id, date }))
    );
  }

  const joinToken = generateToken();
  await admin
    .from("planner_invites")
    .insert({ trip_id: trip.id, token: joinToken, channel: "link" });

  return NextResponse.json({ trip, joinToken }, { status: 201 });
}
