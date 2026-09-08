import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

/**
 * One member's rating of one place, for the 2b rating-capture flow.
 * "Skip this one" writes nothing — there's no DELETE here on purpose,
 * skipping isn't a rating and must not create a row.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; placeId: string }> }
) {
  const { id: tripId, placeId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }

  const { data: place } = await admin
    .from("planner_places")
    .select("id")
    .eq("id", placeId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!place) return NextResponse.json({ error: "Place not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const rating = typeof body.rating === "number" && Number.isFinite(body.rating) ? Math.round(body.rating) : null;
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1-5." }, { status: 400 });
  }
  const ratingBody = typeof body.body === "string" ? body.body.trim().slice(0, 500) : null;

  const { data: saved, error } = await admin
    .from("planner_place_ratings")
    .upsert(
      { trip_id: tripId, place_id: placeId, user_id: user.id, rating, body: ratingBody || null },
      { onConflict: "trip_id,user_id,place_id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rating: saved });
}
