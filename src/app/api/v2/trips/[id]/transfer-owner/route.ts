import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { transferOwner } from "@/lib/planner/membership";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const toUserId = typeof body.user_id === "string" ? body.user_id : null;
  if (!toUserId) return NextResponse.json({ error: "user_id is required." }, { status: 400 });
  if (toUserId === user.id) return NextResponse.json({ error: "You're already the owner." }, { status: 400 });

  const admin = createAdminClient();

  const { data: callerMembership } = await admin
    .from("planner_memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!callerMembership || callerMembership.role !== "owner") {
    return NextResponse.json({ error: "Only the trip owner can transfer it." }, { status: 403 });
  }

  const result = await transferOwner(admin, tripId, user.id, toUserId);
  if (result.outcome === "not_member") return NextResponse.json({ error: "They're not an active member of this trip." }, { status: 400 });
  if (result.outcome === "error") return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ ok: true });
}
