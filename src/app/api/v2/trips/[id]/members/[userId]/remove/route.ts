import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { departMember } from "@/lib/planner/membership";

/** Organizer removes someone else from the trip. Self-removal goes through /leave instead, so the owner-must-transfer-first rule only lives in one place. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id: tripId, userId: targetUserId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Use \"Leave trip\" to remove yourself." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: callerMembership } = await admin
    .from("planner_memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!callerMembership || callerMembership.role !== "owner") {
    return NextResponse.json({ error: "Only the trip owner can remove someone." }, { status: 403 });
  }

  const result = await departMember(admin, tripId, targetUserId, { kind: "removed", removedBy: user.id });

  if (result.outcome === "not_found") return NextResponse.json({ error: "That person isn't on this trip." }, { status: 404 });
  if (result.outcome === "already_gone") return NextResponse.json({ error: "They've already left this trip." }, { status: 400 });
  if (result.outcome === "must_transfer_first") {
    return NextResponse.json({ error: "The trip's owner can't be removed — transfer the trip first." }, { status: 400 });
  }
  if (result.outcome === "error") return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ ok: true });
}
