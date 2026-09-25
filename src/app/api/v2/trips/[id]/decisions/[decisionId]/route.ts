import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { stayNightsFromDates, outsideTripRangeWarning } from "@/lib/planner/calendarDate";

/**
 * Sets (or clears, or corrects) a stay decision's nights from check-in/
 * check-out — the only field this app lets you edit on a decision after
 * creation. Any member, same reasoning as options/[optionId]'s PATCH: a
 * comparison (and the dates behind its pricing) is a shared document,
 * unlike the DELETE below.
 */
export async function PATCH(
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
    .select("id")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (!("check_in" in body) && !("check_out" in body)) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const { nights, error: nightsError } = stayNightsFromDates(body.check_in, body.check_out);
  if (nightsError) return NextResponse.json({ error: nightsError }, { status: 400 });

  let warning: string | null = null;
  if (nights !== null) {
    const { data: trip } = await admin.from("planner_trips").select("start_date, end_date").eq("id", tripId).maybeSingle();
    warning = outsideTripRangeWarning(body.check_in, body.check_out, trip?.start_date ?? null, trip?.end_date ?? null);
  }

  const { data: updated, error } = await admin
    .from("planner_decisions")
    .update({ nights })
    .eq("id", decisionId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ decision: updated, warning });
}

/**
 * Hard delete — this app's convention everywhere except planner_memberships
 * (P1-B's soft-delete is scoped to leave/remove, not a general pattern).
 * Cascades to the decision's options, votes, and notes (all FK'd
 * `on delete cascade` in planner_schema.sql). Owner-only: unlike voting,
 * closing, reopening, or adding/editing an option — all open to any
 * member, since a decision is a shared document — deleting the whole
 * thing at once, history and all, is a bigger and less reversible call.
 */
export async function DELETE(
  _request: Request,
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
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }
  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only the trip owner can delete a decision." }, { status: 403 });
  }

  const { data: decision } = await admin
    .from("planner_decisions")
    .select("id, title")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });

  const { error } = await admin.from("planner_decisions").delete().eq("id", decisionId).eq("trip_id", tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("planner_trip_activity").insert({
    trip_id: tripId,
    text: `"${decision.title}" was deleted.`,
  });

  return NextResponse.json({ ok: true });
}
