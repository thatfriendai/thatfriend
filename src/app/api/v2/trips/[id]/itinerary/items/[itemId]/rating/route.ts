import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: tripId, itemId } = await params;
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

  const { data: item } = await admin
    .from("planner_itinerary_items")
    .select("id")
    .eq("id", itemId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const stars = typeof body.stars === "number" && Number.isFinite(body.stars) ? Math.round(body.stars) : null;
  if (!stars || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "stars must be 1-5." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  const { data: rating, error } = await admin
    .from("planner_item_ratings")
    .upsert(
      { trip_id: tripId, item_id: itemId, user_id: user.id, stars, note: note || null },
      { onConflict: "item_id,user_id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rating });
}
