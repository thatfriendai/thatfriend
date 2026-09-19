import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { computeDateProposal } from "@/lib/planner/dates";

function labelOf(person: { name: string | null; email: string | null } | null) {
  return person?.name || person?.email?.split("@")[0] || "Someone";
}

/** Feeds the Dates modal on the trip page — same data the standalone /dates page renders. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });

  const { data: trip } = await admin.from("planner_trips").select("*").eq("id", tripId).maybeSingle();
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  const { data: members } = await admin
    .from("planner_memberships")
    .select("user_id, planner_users(name, email)")
    .eq("trip_id", tripId);

  const roster = (members ?? []).map((m) => ({
    userId: m.user_id,
    label: labelOf(m.planner_users as unknown as { name: string | null; email: string | null } | null),
  }));

  const { data: markRows } = await admin
    .from("planner_availability_marks")
    .select("user_id, date, created_at")
    .eq("trip_id", tripId);

  const marks = markRows ?? [];
  const { proposal, coverage } = computeDateProposal(marks, roster.length);

  const answeredAt = new Map<string, string>();
  for (const m of marks) {
    const existing = answeredAt.get(m.user_id);
    if (!existing || m.created_at < existing) answeredAt.set(m.user_id, m.created_at);
  }
  const answered = roster.map((m) => ({
    ...m,
    answeredAt: answeredAt.get(m.userId) ?? null,
  }));

  const myMarks = marks.filter((m) => m.user_id === user.id).map((m) => m.date);

  return NextResponse.json({
    tripName: trip.name,
    isOwner: membership.role === "owner",
    myUserId: user.id,
    joinCode: trip.join_code,
    smsNumber: process.env.TWILIO_SMS_NUMBER ?? null,
    datesLockedAt: trip.dates_locked_at,
    lockedStart: trip.start_date,
    lockedEnd: trip.end_date,
    flagNote: trip.dates_flag_note,
    flaggedAt: trip.dates_flagged_at,
    proposal,
    coverage,
    totalMembers: roster.length,
    answered,
    myMarks,
  });
}
