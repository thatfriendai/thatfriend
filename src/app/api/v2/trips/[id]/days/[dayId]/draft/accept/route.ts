import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  const { id: tripId, dayId } = await params;
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

  const { data: day } = await admin
    .from("planner_days")
    .select("id")
    .eq("id", dayId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!day) return NextResponse.json({ error: "Day not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const placeIds: string[] = Array.isArray(body.place_ids)
    ? body.place_ids.filter((v: unknown) => typeof v === "string")
    : [];
  if (placeIds.length === 0) {
    return NextResponse.json({ error: "No places to add." }, { status: 400 });
  }

  // Only places still unscheduled — someone may have scheduled one elsewhere
  // since the draft was generated.
  const { data: places } = await admin
    .from("planner_places")
    .select("id, name, note")
    .eq("trip_id", tripId)
    .is("day_id", null)
    .in("id", placeIds);

  if (!places || places.length === 0) {
    return NextResponse.json({ error: "Those places are no longer available to schedule." }, { status: 400 });
  }

  const { count: existingCount } = await admin
    .from("planner_itinerary_items")
    .select("id", { count: "exact", head: true })
    .eq("day_id", dayId);

  const orderedPlaces = placeIds
    .map((id) => places.find((p) => p.id === id))
    .filter((p): p is (typeof places)[number] => Boolean(p));

  const { data: items, error: itemsError } = await admin
    .from("planner_itinerary_items")
    .insert(
      orderedPlaces.map((p, i) => ({
        day_id: dayId,
        trip_id: tripId,
        text: p.note ? `${p.name} — ${p.note}` : p.name,
        position: (existingCount ?? 0) + i,
        created_by: user.id,
      }))
    )
    .select("*");

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  await admin
    .from("planner_places")
    .update({ day_id: dayId })
    .in(
      "id",
      orderedPlaces.map((p) => p.id)
    );

  return NextResponse.json({ items });
}
