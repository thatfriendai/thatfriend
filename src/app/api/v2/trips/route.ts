import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { generateToken } from "@/lib/planner/tokens";
import type { TripPrivacy } from "@/lib/supabase/planner-types";

export async function POST(request: Request) {
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Trip name is required." }, { status: 400 });

  const privacy: TripPrivacy = body.privacy === "open" ? "open" : "private";

  const admin = createAdminClient();

  const { data: trip, error } = await admin
    .from("planner_trips")
    .insert({
      name,
      destination: body.destination || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      occasion: body.occasion || null,
      budget_band: body.budget_band || null,
      privacy,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error || !trip) {
    return NextResponse.json({ error: error?.message ?? "Could not create trip." }, { status: 500 });
  }

  await admin
    .from("planner_memberships")
    .insert({ trip_id: trip.id, user_id: user.id, role: "owner" });

  const availableDates = Array.isArray(body.available_dates)
    ? [...new Set(body.available_dates.filter((d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))]
    : [];
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
