import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

/**
 * Copies a trip's saved places into a brand-new trip the caller owns.
 * Deliberately does NOT copy days/itinerary items — those carry absolute
 * dates that don't mean anything on a trip with no dates chosen yet. The
 * copier rebuilds their own schedule from the copied places using the
 * itinerary board / day-drafting flow, same as if they'd added the places
 * themselves.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: sourceTrip } = await admin
    .from("planner_trips")
    .select("id, name, destination, occasion, is_public")
    .eq("id", tripId)
    .maybeSingle();
  if (!sourceTrip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  if (!sourceTrip.is_public) {
    const { data: membership } = await admin
      .from("planner_memberships")
      .select("trip_id")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: "This trip isn't public." }, { status: 403 });
  }

  const { data: newTrip, error: tripError } = await admin
    .from("planner_trips")
    .insert({
      name: `Copy of ${sourceTrip.name}`,
      destination: sourceTrip.destination,
      occasion: sourceTrip.occasion,
      privacy: "private",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (tripError || !newTrip) {
    return NextResponse.json({ error: tripError?.message ?? "Could not create the trip." }, { status: 500 });
  }

  await admin.from("planner_memberships").insert({ trip_id: newTrip.id, user_id: user.id, role: "owner" });

  const { data: sourcePlaces } = await admin
    .from("planner_places")
    .select("name, kind, note, map_x, map_y, lat, lng, address")
    .eq("trip_id", tripId);

  if (sourcePlaces && sourcePlaces.length > 0) {
    await admin.from("planner_places").insert(
      sourcePlaces.map((p) => ({
        trip_id: newTrip.id,
        day_id: null,
        name: p.name,
        kind: p.kind,
        note: p.note,
        map_x: p.map_x,
        map_y: p.map_y,
        lat: p.lat,
        lng: p.lng,
        address: p.address,
        added_by: user.id,
        resource_id: null,
      }))
    );
  }

  return NextResponse.json({ tripId: newTrip.id });
}
