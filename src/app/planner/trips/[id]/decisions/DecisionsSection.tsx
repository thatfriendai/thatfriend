"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { NewDecisionModal } from "./NewDecisionModal";
import type { PlannerDecision } from "@/lib/supabase/planner-types";

interface DecisionSummary extends PlannerDecision {
  optionCount: number;
  voteCount: number;
  noteCount: number;
  decidedLabel: string | null;
}

export function DecisionsSection({
  tripId,
  decisions,
  totalMembers,
}: {
  tripId: string;
  decisions: DecisionSummary[];
  totalMembers: number;
}) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();
  const openAddParam = searchParams.get("openAdd");
  const [handledOpenAdd, setHandledOpenAdd] = useState<string | null>(null);
  if (openAddParam && openAddParam !== handledOpenAdd) {
    setHandledOpenAdd(openAddParam);
    if (openAddParam === "decision") setOpen(true);
  }

  return (
    <div id="decisions" className="mb-14">
      <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
        <span className="font-mono text-[11px] text-faint">07</span>
        <span className="text-[25px] font-display text-ink">Decisions</span>
        <button
          onClick={() => setOpen(true)}
          className="ml-auto flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-[13.5px] text-cream hover:bg-accent"
        >
          <span className="text-[15px] leading-none">+</span> Start a decision
        </button>
      </div>

      {decisions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-input-border p-7 text-center">
          <p className="mb-1.5 font-display text-xl text-ink">Nothing to decide yet</p>
          <p className="text-[15px] text-body">
            When something needs a real vote — where to stay, who&rsquo;s driving — start it here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {decisions.map((d) => (
            <Link
              key={d.id}
              href={d.kind === "stay" ? `/planner/trips/${tripId}#stays` : `/planner/trips/${tripId}/decisions/${d.id}`}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-input-border"
              style={{ borderColor: d.status === "open" ? undefined : "#DDD6C8" }}
            >
              <div
                className="h-4.5 w-4.5 flex-none rounded-[5px]"
                style={{
                  background: d.status === "closed" ? "#6E8C6A" : "transparent",
                  border: d.status === "closed" ? "none" : "1px solid #DDD6C8",
                }}
              />
              <div className="min-w-0">
                <div className="text-[15.5px] text-ink-body">{d.title}</div>
                <div className="mt-0.5 text-[13px] text-muted">
                  {d.status === "closed"
                    ? `Decided: ${d.decidedLabel ?? "an option"}`
                    : `${d.optionCount} options`}
                </div>
              </div>
              <div className="ml-auto text-right whitespace-nowrap">
                <div className="font-mono text-[10.5px] tracking-[0.08em] text-muted uppercase">
                  {d.status === "closed" ? "closed" : `${d.voteCount} of ${totalMembers} voted`}
                </div>
                <div className="mt-1 text-[12.5px] text-faint">
                  {d.noteCount} {d.noteCount === 1 ? "note" : "notes"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <NewDecisionModal tripId={tripId} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
