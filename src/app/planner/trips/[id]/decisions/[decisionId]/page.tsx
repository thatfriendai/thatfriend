import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { DecisionDetail } from "./DecisionDetail";

function labelOf(person: { name: string | null; email: string | null } | null) {
  return person?.name || person?.email?.split("@")[0] || "Someone";
}

export default async function DecisionPage({
  params,
}: {
  params: Promise<{ id: string; decisionId: string }>;
}) {
  const { id: tripId, decisionId } = await params;
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) notFound();

  const { data: trip } = await admin
    .from("planner_trips")
    .select("name")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) notFound();

  const { data: decision } = await admin
    .from("planner_decisions")
    .select("*")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!decision) notFound();

  const { data: optionRows } = await admin
    .from("planner_decision_options")
    .select("*")
    .eq("decision_id", decisionId)
    .order("position", { ascending: true });

  const { data: voteRows } = await admin
    .from("planner_decision_votes")
    .select("option_id, user_id, planner_users(name, email)")
    .eq("decision_id", decisionId);

  const { data: noteRows } = await admin
    .from("planner_decision_notes")
    .select("*, planner_users(name, email)")
    .eq("decision_id", decisionId)
    .order("created_at", { ascending: true });

  const { data: members } = await admin
    .from("planner_memberships")
    .select("user_id, planner_users(name, email)")
    .eq("trip_id", tripId);

  const roster = (members ?? []).map((m) => ({
    userId: m.user_id,
    label: labelOf(m.planner_users as unknown as { name: string | null; email: string | null } | null),
  }));

  const votedUserIds = new Set((voteRows ?? []).map((v) => v.user_id));
  const waitingOn = roster.filter((m) => !votedUserIds.has(m.userId)).map((m) => m.label);
  const myVote = (voteRows ?? []).find((v) => v.user_id === user.id);

  const options = (optionRows ?? []).map((o) => ({
    ...o,
    voters: (voteRows ?? [])
      .filter((v) => v.option_id === o.id)
      .map((v) => ({
        label: labelOf(v.planner_users as unknown as { name: string | null; email: string | null } | null),
      })),
  }));

  const notes = (noteRows ?? []).map((n) => ({
    ...n,
    who: labelOf(n.planner_users as unknown as { name: string | null; email: string | null } | null),
  }));

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-card px-7 py-4">
        <Link href={`/planner/trips/${tripId}`} className="text-[14px] text-body hover:text-accent">
          &larr; {trip.name}
        </Link>
      </header>
      <DecisionDetail
        tripId={tripId}
        decisionId={decisionId}
        initialDecision={decision}
        options={options}
        myVoteOptionId={myVote?.option_id ?? null}
        myLabel={labelOf({ name: user.name, email: user.email })}
        totalMembers={roster.length}
        waitingOn={waitingOn}
        notes={notes}
      />
    </div>
  );
}
