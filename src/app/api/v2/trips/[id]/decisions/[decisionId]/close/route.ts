import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { notifyTrip } from "@/lib/planner/notify";

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
    .select("id, status, title")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });
  if (decision.status === "closed") {
    return NextResponse.json({ error: "Already closed." }, { status: 409 });
  }

  const [{ data: votes }, { data: optionRows }] = await Promise.all([
    admin.from("planner_decision_votes").select("option_id").eq("decision_id", decisionId),
    admin
      .from("planner_decision_options")
      .select("id")
      .eq("decision_id", decisionId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const tally = new Map<string, number>();
  for (const v of votes ?? []) {
    tally.set(v.option_id, (tally.get(v.option_id) ?? 0) + 1);
  }
  // Walk options in their listed order (position, then creation) and only
  // replace the leader on a strictly higher count — so a tie always goes to
  // the option listed first, not whichever vote row the database returned
  // first. With no votes at all this also picks the first option.
  let decidedOptionId: string | null = null;
  let top = -1;
  for (const o of optionRows ?? []) {
    const count = tally.get(o.id) ?? 0;
    if (count > top) {
      top = count;
      decidedOptionId = o.id;
    }
  }

  // `.eq("status", "open")` makes this a compare-and-set: if two closes
  // race, only one flips the row, and the loser gets a 409 instead of
  // sending the group a second "decided" text.
  const { data: updated, error } = await admin
    .from("planner_decisions")
    .update({ status: "closed", decided_option_id: decidedOptionId, closed_at: new Date().toISOString() })
    .eq("id", decisionId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Already closed." }, { status: 409 });

  const [{ data: trip }, { data: winningOption }] = await Promise.all([
    admin.from("planner_trips").select("id, name, twilio_conversation_sid").eq("id", tripId).maybeSingle(),
    decidedOptionId
      ? admin.from("planner_decision_options").select("label").eq("id", decidedOptionId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (trip) {
    const what = winningOption?.label ? `${decision.title}: ${winningOption.label}` : decision.title;
    await notifyTrip(admin, trip, `The group decided on ${what}.`);
  }

  return NextResponse.json({ decision: updated });
}
