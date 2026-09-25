import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { notifyTrip } from "@/lib/planner/notify";
import { computeDecisionOutcome } from "@/lib/planner/decisionOutcome";

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
    .eq("status", "active")
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
  if (decision.status !== "open") {
    return NextResponse.json({ error: "Already closed." }, { status: 409 });
  }

  const [{ data: votes }, { data: optionRows }] = await Promise.all([
    admin.from("planner_decision_votes").select("option_id").eq("decision_id", decisionId),
    admin
      .from("planner_decision_options")
      .select("id, label")
      .eq("decision_id", decisionId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const tally = new Map<string, number>();
  for (const v of votes ?? []) {
    tally.set(v.option_id, (tally.get(v.option_id) ?? 0) + 1);
  }
  const counts = (optionRows ?? []).map((o) => ({ id: o.id, label: o.label, count: tally.get(o.id) ?? 0 }));
  const { isTied, decidedOptionId, leaders } = computeDecisionOutcome(counts);
  const maxCount = leaders[0]?.count ?? 0;

  // `.eq("status", "open")` makes this a compare-and-set: if two closes
  // race, only one flips the row, and the loser gets a 409 instead of
  // sending the group a second "decided"/"tied" text.
  const { data: updated, error } = await admin
    .from("planner_decisions")
    .update({
      status: isTied ? "tied" : "closed",
      decided_option_id: decidedOptionId,
      closed_at: new Date().toISOString(),
    })
    .eq("id", decisionId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (error) {
    // 23514 = check constraint: status "tied" needs
    // supabase/migrations/2026-09-29-tied-decisions.sql. Don't show a
    // tester the raw Postgres message.
    console.error("[close decision] update failed", decisionId, error);
    const message =
      error.code === "23514" && isTied
        ? "This vote is tied, and ties can't be saved until the latest database update is applied. Break the tie with one more vote and close it again."
        : "Couldn't close this decision — try again in a moment.";
    return NextResponse.json({ error: message }, { status: error.code === "23514" ? 409 : 500 });
  }
  if (!updated) return NextResponse.json({ error: "Already closed." }, { status: 409 });

  const { data: trip } = await admin
    .from("planner_trips")
    .select("id, name, twilio_conversation_sid")
    .eq("id", tripId)
    .maybeSingle();
  if (trip) {
    if (isTied) {
      const names = leaders.map((l) => l.label);
      const tieText =
        names.length === 2
          ? names.join(" and ")
          : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
      await notifyTrip(
        admin,
        trip,
        `${decision.title} is tied (${maxCount} vote${maxCount === 1 ? "" : "s"} each) between ${tieText} — the trip owner needs to pick.`
      );
    } else {
      const winningLabel = counts.find((c) => c.id === decidedOptionId)?.label ?? null;
      const what = winningLabel ? `${decision.title}: ${winningLabel}` : decision.title;
      await notifyTrip(admin, trip, `The group decided on ${what}.`);
    }
  }

  return NextResponse.json({ decision: updated });
}
