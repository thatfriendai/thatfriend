import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { guideById, GUIDE_KIND_TO_PLACE_KIND } from "@/lib/planner/guides";
import { hashPercent } from "@/lib/planner/itinerary";

/**
 * Copies a guide's places into a brand-new trip the caller owns — the same
 * shape as trips/[id]/copy, except the source is static guide content
 * (guides.ts) rather than another planner_trips row, so there's no
 * source-trip membership/visibility check and no lat/lng to carry over
 * (guide places aren't geocoded, so map_x/map_y are seeded the same way a
 * freshly-added place would be).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: guideId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const guide = guideById(guideId);
  if (!guide) return NextResponse.json({ error: "Guide not found." }, { status: 404 });

  const admin = createAdminClient();

  const { data: newTrip, error: tripError } = await admin
    .from("planner_trips")
    .insert({
      name: guide.city.split(",")[0].trim(),
      destination: guide.city,
      privacy: "private",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (tripError || !newTrip) {
    return NextResponse.json({ error: tripError?.message ?? "Could not create the trip." }, { status: 500 });
  }

  await admin.from("planner_memberships").insert({ trip_id: newTrip.id, user_id: user.id, role: "owner" });

  await admin.from("planner_places").insert(
    guide.places.map((p, i) => {
      const { x, y } = hashPercent(`${newTrip.id}:${i}`);
      return {
        trip_id: newTrip.id,
        day_id: null,
        name: p.name,
        kind: GUIDE_KIND_TO_PLACE_KIND[p.kind],
        note: p.note,
        map_x: x,
        map_y: y,
        added_by: user.id,
      };
    })
  );

  return NextResponse.json({ tripId: newTrip.id });
}
