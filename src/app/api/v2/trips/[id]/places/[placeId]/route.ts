import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

export async function DELETE(
  _request: Request,
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

  const { error } = await admin
    .from("planner_places")
    .delete()
    .eq("id", placeId)
    .eq("trip_id", tripId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Edits the place's group-size note ("Fit 15 of us, long tables"). Empty clears it. */
export async function PATCH(
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

  const body = await request.json().catch(() => ({}));
  if (typeof body.group_note !== "string") {
    return NextResponse.json({ error: "group_note is required." }, { status: 400 });
  }
  const groupNote = body.group_note.trim().slice(0, 120) || null;

  const { data: place, error } = await admin
    .from("planner_places")
    .update({ group_note: groupNote })
    .eq("id", placeId)
    .eq("trip_id", tripId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!place) return NextResponse.json({ error: "Place not found." }, { status: 404 });
  return NextResponse.json({ place });
}
