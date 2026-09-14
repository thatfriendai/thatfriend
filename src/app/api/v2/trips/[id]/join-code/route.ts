import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { generateJoinCode } from "@/lib/planner/tokens";

/** Backfills a join code for a trip created before this feature existed — idempotent, any member can trigger it. */
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
  if (!membership) return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });

  const { data: trip } = await admin.from("planner_trips").select("join_code, destination, name").eq("id", tripId).maybeSingle();
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  if (trip.join_code) return NextResponse.json({ join_code: trip.join_code });

  const code = generateJoinCode(trip.destination ?? trip.name);
  const { data: updated, error } = await admin
    .from("planner_trips")
    .update({ join_code: code })
    .eq("id", tripId)
    .select("join_code")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ join_code: updated.join_code });
}
