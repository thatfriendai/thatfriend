import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { generateToken } from "@/lib/planner/tokens";

export async function POST(
  _request: Request,
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

  const { data: trip } = await admin
    .from("planner_trips")
    .select("share_token")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  if (trip.share_token) return NextResponse.json({ shareToken: trip.share_token });

  const shareToken = generateToken();
  const { error } = await admin
    .from("planner_trips")
    .update({ share_token: shareToken })
    .eq("id", tripId)
    .is("share_token", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: fresh } = await admin
    .from("planner_trips")
    .select("share_token")
    .eq("id", tripId)
    .maybeSingle();

  return NextResponse.json({ shareToken: fresh?.share_token ?? shareToken });
}
