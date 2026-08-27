import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

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
  const dayId = typeof body.day_id === "string" ? body.day_id : null;
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 300) : "";
  if (!dayId || !text) {
    return NextResponse.json({ error: "day_id and text are required." }, { status: 400 });
  }

  const { data: day } = await admin
    .from("planner_days")
    .select("id")
    .eq("id", dayId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!day) return NextResponse.json({ error: "Day not found." }, { status: 404 });

  const { count } = await admin
    .from("planner_itinerary_items")
    .select("*", { count: "exact", head: true })
    .eq("day_id", dayId);

  const { data: item, error } = await admin
    .from("planner_itinerary_items")
    .insert({
      day_id: dayId,
      trip_id: tripId,
      text,
      position: count ?? 0,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item });
}
