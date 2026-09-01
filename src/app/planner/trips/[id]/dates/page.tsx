import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDateProposal } from "@/lib/planner/dates";
import { DatesBoard } from "./DatesBoard";

function labelOf(person: { name: string | null; email: string | null } | null) {
  return person?.name || person?.email?.split("@")[0] || "Someone";
}

export default async function DatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) notFound();

  const { data: trip } = await admin
    .from("planner_trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) notFound();

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

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-card px-7 py-4">
        <Link href={`/planner/trips/${tripId}`} className="text-[14px] text-body hover:text-accent">
          &larr; {trip.name}
        </Link>
      </header>
      <DatesBoard
        tripId={tripId}
        tripName={trip.name}
        isOwner={membership.role === "owner"}
        datesLockedAt={trip.dates_locked_at}
        lockedStart={trip.start_date}
        lockedEnd={trip.end_date}
        flagNote={trip.dates_flag_note}
        flaggedAt={trip.dates_flagged_at}
        proposal={proposal}
        coverage={coverage}
        totalMembers={roster.length}
        answered={answered}
        myMarks={myMarks}
      />
    </div>
  );
}
