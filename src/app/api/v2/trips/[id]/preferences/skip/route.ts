import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

async function requireOwner(admin: ReturnType<typeof createAdminClient>, tripId: string, userId: string) {
  const { data: membership } = await admin
    .from("planner_memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return { error: "Not a member of this trip.", status: 403 as const };
  if (membership.role !== "owner") {
    return { error: "Only the trip owner can do that.", status: 403 as const };
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const ownerError = await requireOwner(admin, tripId, user.id);
  if (ownerError) return NextResponse.json({ error: ownerError.error }, { status: ownerError.status });

  const { data: trip, error } = await admin
    .from("planner_trips")
    .update({ preferences_skipped_at: new Date().toISOString(), preferences_skipped_by: user.id })
    .eq("id", tripId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trip });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const ownerError = await requireOwner(admin, tripId, user.id);
  if (ownerError) return NextResponse.json({ error: ownerError.error }, { status: ownerError.status });

  const { data: trip, error } = await admin
    .from("planner_trips")
    .update({ preferences_skipped_at: null, preferences_skipped_by: null })
    .eq("id", tripId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trip });
}
