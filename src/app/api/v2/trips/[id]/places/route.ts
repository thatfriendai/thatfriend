import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { KIND_OPTIONS, hashPercent } from "@/lib/planner/itinerary";

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
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const kind = KIND_OPTIONS.some((k) => k.kind === body.kind) ? body.kind : null;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
  const dayId = typeof body.day_id === "string" && body.day_id ? body.day_id : null;
  const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
  const lng = typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;
  const address = typeof body.address === "string" ? body.address.trim().slice(0, 300) || null : null;

  if (!name || !kind) {
    return NextResponse.json({ error: "name and kind are required." }, { status: 400 });
  }

  if (dayId) {
    const { data: day } = await admin
      .from("planner_days")
      .select("id")
      .eq("id", dayId)
      .eq("trip_id", tripId)
      .maybeSingle();
    if (!day) return NextResponse.json({ error: "Day not found." }, { status: 404 });
  }

  const id = randomUUID();
  const { x, y } = hashPercent(id);

  const { data: place, error } = await admin
    .from("planner_places")
    .insert({
      id,
      trip_id: tripId,
      day_id: dayId,
      name,
      kind,
      note: note || null,
      map_x: x,
      map_y: y,
      lat,
      lng,
      address,
      added_by: user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ place });
}
