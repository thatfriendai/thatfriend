import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { autoFriendTripMembers } from "@/lib/planner/follows";

/** Owner accepts or declines a join request. Accepting creates the membership directly — no separate invite/accept round-trip needed since the request itself was already an explicit ask. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  const { id: tripId, requestId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only the trip owner can do that." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const decision = body.status === "accepted" ? "accepted" : body.status === "declined" ? "declined" : null;
  if (!decision) return NextResponse.json({ error: "status must be accepted or declined." }, { status: 400 });

  const { data: joinRequest } = await admin
    .from("planner_join_requests")
    .select("id, trip_id, user_id, status")
    .eq("id", requestId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!joinRequest) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (joinRequest.status !== "pending") {
    return NextResponse.json({ error: "Already handled." }, { status: 400 });
  }

  await admin.from("planner_join_requests").update({ status: decision }).eq("id", requestId);

  if (decision === "accepted") {
    await admin
      .from("planner_memberships")
      .upsert(
        { trip_id: tripId, user_id: joinRequest.user_id, role: "member" },
        { onConflict: "trip_id,user_id", ignoreDuplicates: true }
      );
    await autoFriendTripMembers(admin, tripId, joinRequest.user_id);
  }

  return NextResponse.json({ ok: true });
}
