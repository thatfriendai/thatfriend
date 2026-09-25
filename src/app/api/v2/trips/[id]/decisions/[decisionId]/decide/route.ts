import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { notifyTrip } from "@/lib/planner/notify";

/**
 * Only reachable from a `tied` decision — the trip owner breaks the tie by
 * hand instead of the group re-voting. Mirrors close/route.ts's own
 * compare-and-set, but gated to the owner (unlike close/reopen, which any
 * member can do — a tie-break is a real, one-sided call, not routine bookkeeping).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; decisionId: string }> }
) {
  const { id: tripId, decisionId } = await params;
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
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }
  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only the trip owner can settle a tie." }, { status: 403 });
  }

  const { data: decision } = await admin
    .from("planner_decisions")
    .select("id, title, status")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });
  if (decision.status !== "tied") {
    return NextResponse.json({ error: "This decision isn't tied." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const optionId = typeof body.option_id === "string" ? body.option_id : "";
  if (!optionId) return NextResponse.json({ error: "option_id is required." }, { status: 400 });

  const { data: option } = await admin
    .from("planner_decision_options")
    .select("id, label")
    .eq("id", optionId)
    .eq("decision_id", decisionId)
    .maybeSingle();
  if (!option) return NextResponse.json({ error: "Option not found." }, { status: 404 });

  const { data: updated, error } = await admin
    .from("planner_decisions")
    .update({ status: "closed", decided_option_id: optionId, closed_at: new Date().toISOString() })
    .eq("id", decisionId)
    .eq("status", "tied")
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "This decision isn't tied." }, { status: 409 });

  const { data: trip } = await admin
    .from("planner_trips")
    .select("id, name, twilio_conversation_sid")
    .eq("id", tripId)
    .maybeSingle();
  if (trip) {
    await notifyTrip(admin, trip, `${decision.title} was tied — the trip owner picked ${option.label}.`);
  }

  return NextResponse.json({ decision: updated });
}
