import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { KIND_OPTIONS } from "@/lib/planner/itinerary";

export async function POST(request: Request) {
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const kind = KIND_OPTIONS.some((k) => k.kind === body.kind) ? body.kind : "Other";
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });

  const sourcePlaceId = typeof body.source_place_id === "string" ? body.source_place_id : null;
  const sourceTripId = typeof body.source_trip_id === "string" ? body.source_trip_id : null;
  const sourceUserId = typeof body.source_user_id === "string" ? body.source_user_id : null;
  const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
  const lng = typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;
  const address = typeof body.address === "string" ? body.address.trim().slice(0, 300) || null : null;
  const googlePlaceId = typeof body.google_place_id === "string" ? body.google_place_id : null;
  const photoUrl = typeof body.photo_url === "string" ? body.photo_url : null;

  const admin = createAdminClient();

  if (sourcePlaceId) {
    const { data: existing } = await admin
      .from("planner_saved_places")
      .select("id")
      .eq("user_id", user.id)
      .eq("source_place_id", sourcePlaceId)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "Already saved.", duplicate: true }, { status: 409 });
  }

  const { data: saved, error } = await admin
    .from("planner_saved_places")
    .insert({
      user_id: user.id,
      source_place_id: sourcePlaceId,
      source_trip_id: sourceTripId,
      source_user_id: sourceUserId,
      name,
      kind,
      lat,
      lng,
      address,
      google_place_id: googlePlaceId,
      photo_url: photoUrl,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ savedPlace: saved });
}
