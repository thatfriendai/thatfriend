import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { geocodePlace } from "@/lib/planner/geocode";

/**
 * Resolves a hotel/listing name to a real address, biased toward the trip's
 * destination — used by the "already booked" form to confirm a hotel's
 * location before saving it. A miss (no key, no match) is a normal, expected
 * outcome here (private listings and typos both look like this), not an error.
 */
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
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return NextResponse.json({ error: "A name is required." }, { status: 400 });

  const { data: trip } = await admin
    .from("planner_trips")
    .select("destination")
    .eq("id", tripId)
    .maybeSingle();

  const fullQuery = trip?.destination ? `${query}, ${trip.destination}` : query;
  const result = await geocodePlace(fullQuery, { wantPhoto: false });

  if (!result) return NextResponse.json({ match: null });
  return NextResponse.json({
    match: { address: result.address, lat: result.lat, lng: result.lng },
  });
}
