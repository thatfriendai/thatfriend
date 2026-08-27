import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

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
    return NextResponse.json({ error: "This decision is closed." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const optionId = typeof body.option_id === "string" ? body.option_id : "";
  if (!optionId) return NextResponse.json({ error: "option_id is required." }, { status: 400 });

  const { data: option } = await admin
    .from("planner_decision_options")
    .select("id")
    .eq("id", optionId)
    .eq("decision_id", decisionId)
    .maybeSingle();
  if (!option) return NextResponse.json({ error: "Option not found." }, { status: 404 });

  const { data: vote, error } = await admin
    .from("planner_decision_votes")
    .upsert(
      { decision_id: decisionId, option_id: optionId, user_id: user.id },
      { onConflict: "decision_id,user_id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vote });
}
