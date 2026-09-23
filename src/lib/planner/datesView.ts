import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlannerUser } from "./session";
import { computeDateProposal, earliestProposableDate, upcomingMarks, type DateCoverageDay, type DateProposal } from "./dates";

export interface DatesViewPayload {
  tripName: string;
  isOwner: boolean;
  myUserId: string;
  joinCode: string | null;
  smsNumber: string | null;
  datesLockedAt: string | null;
  lockedStart: string | null;
  lockedEnd: string | null;
  flagNote: string | null;
  flagReason: string | null;
  flaggedAt: string | null;
  flaggedByName: string | null;
  proposal: DateProposal | null;
  coverage: DateCoverageDay[];
  totalMembers: number;
  answered: { userId: string; label: string; answeredAt: string | null }[];
  myMarks: string[];
  /** Who marked each date free, by user id — the per-person dots on the heatmap. */
  freeByDate: Record<string, string[]>;
}

export type DatesViewResult =
  | { status: "ok"; payload: DatesViewPayload }
  | { status: "unauthenticated" | "not_member" | "not_found" };

function labelOf(person: { name: string | null; email: string | null } | null) {
  return person?.name || person?.email?.split("@")[0] || "Someone";
}

/**
 * Everything the Dates view needs, for both the standalone page and the
 * trip-page modal's API route — one loader so the two can't drift.
 *
 * Shaped around round trips, which is all this endpoint's latency ever
 * was: the three trip queries don't depend on the signed-in user, so they
 * start alongside the auth lookup instead of after it, and the roster
 * query carries `role`, so "is this person a member, and are they the
 * owner" is answered from rows we already have rather than a query of its
 * own.
 */
export async function loadDatesView(admin: SupabaseClient, tripId: string): Promise<DatesViewResult> {
  const [user, { data: trip }, { data: memberRows }, { data: markRows }] = await Promise.all([
    getPlannerUser(),
    admin.from("planner_trips").select("*").eq("id", tripId).maybeSingle(),
    admin.from("planner_memberships").select("user_id, role, planner_users(name, email)").eq("trip_id", tripId),
    admin.from("planner_availability_marks").select("user_id, date, created_at").eq("trip_id", tripId),
  ]);

  if (!user) return { status: "unauthenticated" };
  if (!trip) return { status: "not_found" };

  const members = memberRows ?? [];
  const mine = members.find((m) => m.user_id === user.id);
  if (!mine) return { status: "not_member" };

  const roster = members.map((m) => ({
    userId: m.user_id as string,
    label: labelOf(m.planner_users as unknown as { name: string | null; email: string | null } | null),
  }));

  const marks = markRows ?? [];
  // Past days stay in myMarks/freeByDate (they're still what people said),
  // but only upcoming ones get a say in the proposal and its heatmap.
  const { proposal, coverage } = computeDateProposal(upcomingMarks(marks, earliestProposableDate()), roster.length);

  const freeByDate: Record<string, string[]> = {};
  for (const m of marks) (freeByDate[m.date] ??= []).push(m.user_id);

  const answeredAt = new Map<string, string>();
  for (const m of marks) {
    const existing = answeredAt.get(m.user_id);
    if (!existing || m.created_at < existing) answeredAt.set(m.user_id, m.created_at);
  }

  return {
    status: "ok",
    payload: {
      tripName: trip.name,
      isOwner: mine.role === "owner",
      myUserId: user.id,
      joinCode: trip.join_code,
      smsNumber: process.env.TWILIO_SMS_NUMBER ?? null,
      datesLockedAt: trip.dates_locked_at,
      lockedStart: trip.start_date,
      lockedEnd: trip.end_date,
      flagNote: trip.dates_flag_note,
      flagReason: trip.dates_flag_reason,
      flaggedAt: trip.dates_flagged_at,
      flaggedByName: trip.dates_flagged_by
        ? (roster.find((m) => m.userId === trip.dates_flagged_by)?.label ?? "Someone")
        : null,
      proposal,
      coverage,
      totalMembers: roster.length,
      answered: roster.map((m) => ({ ...m, answeredAt: answeredAt.get(m.userId) ?? null })),
      myMarks: marks.filter((m) => m.user_id === user.id).map((m) => m.date),
      freeByDate,
    },
  };
}
