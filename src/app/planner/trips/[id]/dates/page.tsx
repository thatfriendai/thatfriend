import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadDatesView } from "@/lib/planner/datesView";
import { DatesBoard } from "./DatesBoard";

export default async function DatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tripId } = await params;
  const result = await loadDatesView(createAdminClient(), tripId);
  if (result.status === "unauthenticated") redirect("/planner/login");
  if (result.status !== "ok") notFound();
  const dates = result.payload;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-card px-7 py-5">
        <Link href={`/planner/trips/${tripId}`} className="flex items-center gap-2 text-[17px] font-medium text-ink hover:text-accent">
          <span aria-hidden>&larr;</span> {dates.tripName}
        </Link>
      </header>
      <DatesBoard
        tripId={tripId}
        tripName={dates.tripName}
        isOwner={dates.isOwner}
        myUserId={dates.myUserId}
        joinCode={dates.joinCode}
        smsNumber={dates.smsNumber}
        datesLockedAt={dates.datesLockedAt}
        lockedStart={dates.lockedStart}
        lockedEnd={dates.lockedEnd}
        flagNote={dates.flagNote}
        flagReason={dates.flagReason}
        flaggedAt={dates.flaggedAt}
        flaggedByName={dates.flaggedByName}
        proposal={dates.proposal}
        coverage={dates.coverage}
        totalMembers={dates.totalMembers}
        answered={dates.answered}
        myMarks={dates.myMarks}
      />
    </div>
  );
}
