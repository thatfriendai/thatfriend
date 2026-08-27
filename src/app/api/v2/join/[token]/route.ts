import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("planner_invites")
    .select("trip_id")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "This invite link isn't valid." }, { status: 404 });
  }

  const { data: trip } = await admin
    .from("planner_trips")
    .select("id, name, destination, start_date, end_date, occasion")
    .eq("id", invite.trip_id)
    .maybeSingle();

  if (!trip) {
    return NextResponse.json({ error: "This trip no longer exists." }, { status: 404 });
  }

  return NextResponse.json({ trip });
}
