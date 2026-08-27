import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; decisionId: string }> }
) {
  const { id: tripId, decisionId } = await params;
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

  const { data: decision } = await admin
    .from("planner_decisions")
    .select("id, status")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });
  if (decision.status === "closed") {
    return NextResponse.json({ error: "Already closed." }, { status: 409 });
  }

  const { data: votes } = await admin
    .from("planner_decision_votes")
    .select("option_id")
    .eq("decision_id", decisionId);

  const tally = new Map<string, number>();
  for (const v of votes ?? []) {
    tally.set(v.option_id, (tally.get(v.option_id) ?? 0) + 1);
  }
  let decidedOptionId: string | null = null;
  let top = -1;
  for (const [optionId, count] of tally) {
    if (count > top) {
      top = count;
      decidedOptionId = optionId;
    }
  }

  if (!decidedOptionId) {
    const { data: firstOption } = await admin
      .from("planner_decision_options")
      .select("id")
      .eq("decision_id", decisionId)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    decidedOptionId = firstOption?.id ?? null;
  }

  const { data: updated, error } = await admin
    .from("planner_decisions")
    .update({ status: "closed", decided_option_id: decidedOptionId, closed_at: new Date().toISOString() })
    .eq("id", decisionId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ decision: updated });
}
