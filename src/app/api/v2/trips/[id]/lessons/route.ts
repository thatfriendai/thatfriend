import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

/** "What would you do differently?" — one line each, saved for this group's next trip. */

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (!membership) return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 240) : "";
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });

  const { data: lesson, error } = await admin
    .from("planner_trip_lessons")
    .insert({ trip_id: tripId, user_id: user.id, body: text })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lesson });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  // Only your own line — the filter on user_id is the permission check.
  const { error } = await createAdminClient()
    .from("planner_trip_lessons")
    .delete()
    .eq("id", id)
    .eq("trip_id", tripId)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
