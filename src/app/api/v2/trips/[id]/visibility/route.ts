import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only the trip owner can change this." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const isPublic = Boolean(body.is_public);

  const { data: trip, error } = await admin
    .from("planner_trips")
    .update({ is_public: isPublic })
    .eq("id", tripId)
    .select("id, is_public")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trip });
}
