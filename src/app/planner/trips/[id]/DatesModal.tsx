"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DatesBoard } from "./dates/DatesBoard";
import type { DatesViewPayload } from "@/lib/planner/datesView";
import { SlowLoadNotice } from "@/components/planner/SlowLoadNotice";

// Type-only: erased at build, so the server-only loader never reaches the client bundle.
type DatesPayload = DatesViewPayload;

export function DatesModal({ tripId, dateRangeLabel }: { tripId: string; dateRangeLabel: string }) {
  const router = useRouter();
  const fetchRef = useRef<Promise<DatesPayload> | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DatesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Anything decided in here (dates locked, availability marked) changes
  // what the page behind it shows — "The plan so far" builds its days from
  // the locked range — so closing always re-renders the page underneath.
  function close() {
    setOpen(false);
    // What's shown is now stale (dates may have been marked or locked) —
    // drop it so the next open re-reads, and re-render the page behind.
    setData(null);
    fetchRef.current = null;
    router.refresh();
  }

  // Warmed on hover/touch, before the tap lands: the fetch is a few
  // hundred ms of round trips, and starting it early usually means the
  // modal has its data by the time it opens. Kicked off at most once, and
  // never awaited here — openModal awaits the same promise.
  function prefetch() {
    if (!fetchRef.current) {
      fetchRef.current = fetch(`/api/v2/trips/${tripId}/dates`).then((res) => {
        if (!res.ok) throw new Error("Could not load dates.");
        return res.json();
      });
      // A failed warm-up shouldn't surface as an unhandled rejection —
      // openModal awaits the same promise and reports it properly there.
      fetchRef.current.catch(() => {});
    }
    return fetchRef.current;
  }

  // Something changed inside the board (marks saved, dates locked) — re-read
  // so the board isn't left rendering the copy from before the change.
  async function reload() {
    fetchRef.current = null;
    try {
      setData(await prefetch());
    } catch {
      fetchRef.current = null;
      setError("Could not load dates.");
    }
  }

  async function openModal() {
    setOpen(true);
    setError(null);
    if (data) return;
    setLoading(true);
    try {
      setData(await prefetch());
    } catch {
      // Let the next open try again rather than staying stuck on the error.
      fetchRef.current = null;
      setError("Could not load dates.");
    }
    setLoading(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        onMouseEnter={prefetch}
        onTouchStart={prefetch}
        onFocus={prefetch}
        className="flex items-center gap-1.5 rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[13px] text-ink hover:border-ink"
      >
        <span className="font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Dates</span>
        {dateRangeLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-10"
          onClick={close}
        >
          <div
            className="w-full max-w-[900px] rounded-2xl border border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-end px-6 pt-5">
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex-none rounded-full border border-input-border bg-card px-2.5 py-1 text-[13px] text-muted hover:border-ink hover:text-ink"
              >
                Close
              </button>
            </div>

            {loading && (
              <div className="px-9 pb-9">
                <SlowLoadNotice inline message="Pulling up everyone's dates" />
              </div>
            )}
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
                freeByDate={data.freeByDate}
                onChanged={reload}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
