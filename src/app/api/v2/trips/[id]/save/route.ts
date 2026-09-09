import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

async function requirePublicTrip(admin: ReturnType<typeof createAdminClient>, tripId: string) {
  const { data: trip } = await admin.from("planner_trips").select("id, is_public").eq("id", tripId).maybeSingle();
  return trip && trip.is_public ? trip : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const trip = await requirePublicTrip(admin, tripId);
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  const { error } = await admin
    .from("planner_trip_saves")
    .upsert({ user_id: user.id, trip_id: tripId }, { onConflict: "user_id,trip_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from("planner_trip_saves").delete().eq("user_id", user.id).eq("trip_id", tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
