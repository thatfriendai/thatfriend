"use client";

import { useState } from "react";
import { DatesBoard } from "./dates/DatesBoard";
import type { DateCoverageDay, DateProposal } from "@/lib/planner/dates";

interface DatesPayload {
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
}

export function DatesModal({ tripId, dateRangeLabel }: { tripId: string; dateRangeLabel: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DatesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openModal() {
    setOpen(true);
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/dates`);
    setLoading(false);
    if (!res.ok) {
      setError("Could not load dates.");
      return;
    }
    setData(await res.json());
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-1.5 rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[13px] text-ink hover:border-ink"
      >
        <span className="font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Dates</span>
        {dateRangeLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-10"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[900px] rounded-2xl border border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-end px-6 pt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex-none rounded-full border border-input-border bg-card px-2.5 py-1 text-[13px] text-muted hover:border-ink hover:text-ink"
              >
                Close
              </button>
            </div>

            {loading && <p className="px-9 pb-9 text-[14.5px] text-muted">Loading…</p>}
            {error && <p className="px-9 pb-9 text-[14.5px] text-red-700">{error}</p>}
            {data && (
              <DatesBoard
                tripId={tripId}
                tripName={data.tripName}
                isOwner={data.isOwner}
                myUserId={data.myUserId}
                joinCode={data.joinCode}
                smsNumber={data.smsNumber}
                datesLockedAt={data.datesLockedAt}
                lockedStart={data.lockedStart}
                lockedEnd={data.lockedEnd}
                flagNote={data.flagNote}
                flagReason={data.flagReason}
                flaggedAt={data.flaggedAt}
                flaggedByName={data.flaggedByName}
                proposal={data.proposal}
                coverage={data.coverage}
                totalMembers={data.totalMembers}
                answered={data.answered}
                myMarks={data.myMarks}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
