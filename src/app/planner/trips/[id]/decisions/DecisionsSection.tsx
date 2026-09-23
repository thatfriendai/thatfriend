"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NewDecisionModal } from "./NewDecisionModal";
import type { PlannerDecision } from "@/lib/supabase/planner-types";

interface DecisionSummary extends PlannerDecision {
  optionCount: number;
  voteCount: number;
  noteCount: number;
  decidedLabel: string | null;
  optionVotes: { label: string; count: number }[];
}

function formatClosedDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// A real sentence built from the actual per-option vote tally — never a
// stand-in for reasoning nobody recorded. optionVotes is sorted highest
// first (see page.tsx), but on a tie that order needn't match the option
// the close route actually picked (the first-listed one), so the decided
// option is moved to the front before reading [0] as the winner.
function describeOutcome(
  optionVotes: { label: string; count: number }[],
  decidedLabel: string | null
): string {
  const total = optionVotes.reduce((sum, o) => sum + o.count, 0);
  if (total === 0) return "No votes were cast before this closed.";
  const decidedIndex = decidedLabel ? optionVotes.findIndex((o) => o.label === decidedLabel) : -1;
  const ordered =
    decidedIndex > 0
      ? [optionVotes[decidedIndex], ...optionVotes.slice(0, decidedIndex), ...optionVotes.slice(decidedIndex + 1)]
      : optionVotes;
  const [top, second] = ordered;
  if (!second || second.count === 0) {
    return `Uncontested — ${top.count} vote${top.count === 1 ? "" : "s"}.`;
  }
  if (second.count === top.count) {
    return `Tied ${top.count}–${second.count} with ${second.label}; it went to the option listed first.`;
  }
  return `${top.count} vote${top.count === 1 ? "" : "s"} to ${second.count} against ${second.label}.`;
}

function ReopenButton({ tripId, decisionId }: { tripId: string; decisionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function reopen() {
    setPending(true);
    const res = await fetch(`/api/v2/trips/${tripId}/decisions/${decisionId}/reopen`, { method: "POST" });
    if (res.ok) router.refresh();
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={reopen}
      disabled={pending}
      className="mt-3 rounded-full border border-input-border bg-transparent px-3.5 py-1.5 text-[13px] text-muted hover:border-ink hover:text-ink disabled:opacity-50"
    >
      {pending ? "Reopening…" : "Reopen"}
    </button>
  );
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
  const [tab, setTab] = useState<"open" | "closed">("open");
  const searchParams = useSearchParams();
  const openAddParam = searchParams.get("openAdd");
  const [handledOpenAdd, setHandledOpenAdd] = useState<string | null>(null);
  if (openAddParam && openAddParam !== handledOpenAdd) {
    setHandledOpenAdd(openAddParam);
    if (openAddParam === "decision") setOpen(true);
  }

  const openDecisions = decisions.filter((d) => d.status === "open");
  const closedDecisions = decisions.filter((d) => d.status === "closed");

  return (
    <div id="decisions" className="mb-14">
      <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
        <span className="font-mono text-[11px] text-faint">05</span>
        <span className="text-[25px] font-display text-ink">Decisions</span>
        {decisions.length > 0 && (
          <div className="ml-auto flex items-center gap-1 rounded-full border border-border bg-warm-bg p-0.5">
            {(["open", "closed"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] capitalize transition-colors ${
                  tab === t ? "bg-ink text-cream" : "text-body"
                }`}
              >
                {t} &middot; {t === "open" ? openDecisions.length : closedDecisions.length}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen(true)}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-[13.5px] text-cream hover:bg-accent ${
            decisions.length > 0 ? "" : "ml-auto"
          }`}
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
      ) : tab === "open" ? (
        openDecisions.length === 0 ? (
          <p className="text-[14.5px] text-muted">Nothing open right now.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {openDecisions.map((d) => (
              <Link
                key={d.id}
                // Every decision, stays included, links to its own page — the
                // #stays section only renders the newest stay decision, so
                // pointing older ones there left them unreachable.
                href={`/planner/trips/${tripId}/decisions/${d.id}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-input-border"
              >
                <div className="h-4.5 w-4.5 flex-none rounded-[5px]" style={{ border: "1px solid #DDD6C8" }} />
                <div className="min-w-0">
                  <div className="text-[15.5px] text-ink-body">{d.title}</div>
                  <div className="mt-0.5 text-[13px] text-muted">{d.optionCount} options</div>
                </div>
                <div className="ml-auto text-right whitespace-nowrap">
                  <div className="font-mono text-[10.5px] tracking-[0.08em] text-muted uppercase">
                    {d.voteCount} of {totalMembers} voted
                  </div>
                  <div className="mt-1 text-[14.5px] text-faint">
                    {d.noteCount} {d.noteCount === 1 ? "note" : "notes"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : closedDecisions.length === 0 ? (
        <p className="text-[14.5px] text-muted">Nothing closed yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="mb-1 max-w-[46em] text-[14px] leading-relaxed text-muted">
            Settled. Check here before you go looking for something the group already picked.
          </p>
          {closedDecisions.map((d) => (
            <div key={d.id} className="rounded-xl border border-border bg-card px-5 py-4.5">
              <div className="mb-2 flex items-baseline gap-3">
                <div className="text-[15.5px] text-ink-body">{d.title}</div>
                <div className="ml-auto flex-none font-mono text-[10.5px] tracking-[0.08em] text-positive uppercase">
                  Closed {formatClosedDate(d.closed_at)}
                </div>
              </div>
              <div className="mb-2.5 rounded-lg border border-positive/30 bg-positive/5 px-3.5 py-3">
                <div className="mb-1 font-mono text-[10px] tracking-[0.1em] text-positive uppercase">Outcome</div>
                <div className="text-[15px] text-ink-body">{d.decidedLabel ?? d.title}</div>
              </div>
              <p className="text-[13px] leading-relaxed text-muted">{describeOutcome(d.optionVotes, d.decidedLabel)}</p>
              {d.kind !== "stay" && <ReopenButton tripId={tripId} decisionId={d.id} />}
            </div>
          ))}
        </div>
      )}

      <NewDecisionModal tripId={tripId} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
