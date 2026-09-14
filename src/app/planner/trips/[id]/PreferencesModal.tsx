"use client";

import { useEffect, useState } from "react";
import { PreferencesForm } from "./preferences/PreferencesForm";
import type { PlannerPreference } from "@/lib/supabase/planner-types";

export function PreferencesModal({
  tripId,
  tripName,
  initial,
  isPrivate,
  datesLocked,
  initialAvailableDates,
}: {
  tripId: string;
  tripName: string;
  initial: PlannerPreference | null;
  isPrivate: boolean;
  datesLocked: boolean;
  initialAvailableDates: string[];
}) {
  const [open, setOpen] = useState(false);

  // The Convergence pop-out hands off here when someone tries to view
  // "where we landed" before they've answered themselves — a plain DOM
  // event keeps these two sibling modals decoupled instead of lifting
  // their open state up into the trip page.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-preferences-modal", handler);
    return () => window.removeEventListener("open-preferences-modal", handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[13px] text-ink hover:border-ink"
      >
        <span className="font-mono text-[10px] tracking-[0.08em] text-faint uppercase">Preferences</span>
        {initial ? "Added" : "Not set"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-10"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[640px] rounded-2xl border border-border bg-card p-7.5 sm:p-9"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
                  Your preferences for {tripName}
                </p>
                <h2 className="text-[28px] leading-[1.1] font-display tracking-tight text-ink">
                  What would make this trip good for you?
                </h2>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-body">
                  {isPrivate
                    ? "Nobody sees what you put — say the real number."
                    : "Everyone can see answers as they come in on this trip."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex-none rounded-full border border-input-border bg-card px-2.5 py-1 text-[13px] text-muted hover:border-ink hover:text-ink"
              >
                Close
              </button>
            </div>

            <PreferencesForm
              tripId={tripId}
              initial={initial}
              isPrivate={isPrivate}
              datesLocked={datesLocked}
              initialAvailableDates={initialAvailableDates}
            />
          </div>
        </div>
      )}
    </>
  );
}
