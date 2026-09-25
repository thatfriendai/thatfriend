import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { autoFriendTripMembers } from "@/lib/planner/follows";
import { addParticipantToConversation } from "@/lib/twilio/conversations";
import { toE164 } from "@/lib/planner/phone";
import { MAX_TRAVELERS_PER_TRIP } from "@/config/limits";

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
    .eq("status", "active")
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

  if (decision === "accepted") {
    const { count } = await admin
      .from("planner_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("trip_id", tripId)
      .eq("status", "active");
    if ((count ?? 0) >= MAX_TRAVELERS_PER_TRIP) {
      return NextResponse.json(
        { error: `This trip is already at its limit of ${MAX_TRAVELERS_PER_TRIP} travelers.` },
        { status: 400 }
      );
    }
  }

  await admin.from("planner_join_requests").update({ status: decision }).eq("id", requestId);

  if (decision === "accepted") {
    // A real upsert (not ignoreDuplicates) — a previously left/removed row
    // (P1-B) needs to actually flip back to active on re-acceptance, not
    // silently no-op and stay departed.
    await admin
      .from("planner_memberships")
      .upsert(
        { trip_id: tripId, user_id: joinRequest.user_id, role: "member", status: "active", left_at: null, removed_by: null },
        { onConflict: "trip_id,user_id" }
      );
    await autoFriendTripMembers(admin, tripId, joinRequest.user_id);

    // If the trip's group text already exists, sweep the newly-accepted
    // member into it too — same as the invite-link join paths already do.
    // Without this, anyone who joins by request (rather than a link) never
    // gets added to an in-progress group thread.
    const [{ data: trip }, { data: newMember }] = await Promise.all([
      admin.from("planner_trips").select("twilio_conversation_sid").eq("id", tripId).maybeSingle(),
      admin.from("planner_users").select("phone").eq("id", joinRequest.user_id).maybeSingle(),
    ]);
    if (trip?.twilio_conversation_sid && newMember?.phone) {
      await addParticipantToConversation(trip.twilio_conversation_sid, toE164(newMember.phone)).catch(() => {
        // Best-effort — they can still be synced into the group thread later.
      });
    }
  }

  return NextResponse.json({ ok: true });
}
