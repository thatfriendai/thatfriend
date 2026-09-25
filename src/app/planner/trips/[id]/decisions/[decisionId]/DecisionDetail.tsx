"use client";

import { useState } from "react";
import { StayMatrix, type StayComparisonData } from "./StayMatrix";
import type {
  PlannerDecision,
  PlannerDecisionNote,
  PlannerDecisionOption,
} from "@/lib/supabase/planner-types";
import { DAY_COLORS } from "@/lib/planner/itinerary";
import { celebrateDecisionClosed } from "@/lib/planner/confetti";
import { initialsOf } from "@/lib/planner/initials";

const AVATAR_COLORS = DAY_COLORS;

interface OptionWithVotes extends PlannerDecisionOption {
  voters: { label: string }[];
}

interface NoteWithWho extends PlannerDecisionNote {
  who: string;
}

function removeOne<T extends { label: string }>(list: T[], label: string): T[] {
  const idx = list.findIndex((v) => v.label === label);
  if (idx === -1) return list;
  return [...list.slice(0, idx), ...list.slice(idx + 1)];
}

export function DecisionDetail({
  tripId,
  decisionId,
  initialDecision,
  options: initialOptions,
  myVoteOptionId,
  myUserId,
  myLabel,
  totalMembers,
  waitingOn: initialWaitingOn,
  notes: initialNotes,
  initialComparison,
  isOwner,
}: {
  tripId: string;
  decisionId: string;
  initialDecision: PlannerDecision;
  options: OptionWithVotes[];
  myVoteOptionId: string | null;
  myUserId: string;
  myLabel: string;
  totalMembers: number;
  waitingOn: string[];
  notes: NoteWithWho[];
  initialComparison: StayComparisonData | null;
  isOwner: boolean;
}) {
  const [decision, setDecision] = useState(initialDecision);
  const [options, setOptions] = useState(initialOptions);
  const [myVote, setMyVote] = useState(myVoteOptionId);
  const [optionVotes, setOptionVotes] = useState(
    Object.fromEntries(initialOptions.map((o) => [o.id, o.voters]))
  );
  const [waitingOn, setWaitingOn] = useState(initialWaitingOn);
  const [voting, setVoting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  // StayMatrix manages its own option list (a stay option can be pasted in
  // after this page loaded) and reports label changes back here, so the
  // "group went with X" summary below can name a freshly-added option
  // without a reload.
  const [stayOptionLabels, setStayOptionLabels] = useState<Record<string, string>>(
    Object.fromEntries((initialComparison?.options ?? []).map((o) => [o.id, o.label]))
  );
  const [draftNote, setDraftNote] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  const isOpen = decision.status === "open";
  const isTied = decision.status === "tied";
  const totalVotes = Object.values(optionVotes).reduce((n, v) => n + v.length, 0);
  const maxVotesOnTie = isTied
    ? Object.values(optionVotes).reduce((m, v) => Math.max(m, v.length), 0)
    : 0;
  const tieLeaders = isTied
    ? options.filter((o) => (optionVotes[o.id]?.length ?? 0) === maxVotesOnTie && maxVotesOnTie > 0)
    : [];

  async function castVote(optionId: string) {
    if (!isOpen || voting) return;
    setVoting(true);
    setError(null);
    const previous = myVote;
    setMyVote(optionId);
    // `?? []` throughout: a stay option pasted in via StayMatrix after this
    // page loaded has no entry in optionVotes yet, and spreading undefined
    // would crash the page on the first vote for it.
    setOptionVotes((v) => {
      const next = { ...v };
      if (previous) next[previous] = removeOne(next[previous] ?? [], myLabel);
      next[optionId] = [...(next[optionId] ?? []), { label: myLabel }];
      return next;
    });
    if (!previous) setWaitingOn((list) => list.filter((l) => l !== myLabel));

    const rollback = () => {
      setMyVote(previous);
      setOptionVotes((v) => {
        const next = { ...v };
        next[optionId] = removeOne(next[optionId] ?? [], myLabel);
        if (previous) next[previous] = [...(next[previous] ?? []), { label: myLabel }];
        return next;
      });
      if (!previous) setWaitingOn((list) => [...list, myLabel]);
      setError("Your vote didn't go through. Try again.");
    };

    // try/finally so a dropped connection can't leave every vote button
    // disabled until reload.
    try {
      const res = await fetch(`/api/v2/trips/${tripId}/decisions/${decisionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_id: optionId }),
      });
      if (!res.ok) rollback();
    } catch {
      rollback();
    } finally {
      setVoting(false);
    }
  }

  async function closeDecision() {
    if (closing) return;
    setClosing(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/trips/${tripId}/decisions/${decisionId}/close`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't close this decision.");
        return;
      }
      setDecision(data.decision);
      celebrateDecisionClosed();
    } catch {
      setError("Couldn't close this decision.");
    } finally {
      setClosing(false);
    }
  }

  async function decideWinner(optionId: string) {
    if (deciding) return;
    setDeciding(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/trips/${tripId}/decisions/${decisionId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_id: optionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't settle the tie.");
        return;
      }
      setDecision(data.decision);
      celebrateDecisionClosed();
    } catch {
      setError("Couldn't settle the tie.");
    } finally {
      setDeciding(false);
    }
  }

  async function reopenDecision() {
    if (reopening) return;
    setReopening(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/trips/${tripId}/decisions/${decisionId}/reopen`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't reopen this decision.");
        return;
      }
      setDecision(data.decision);
    } catch {
      setError("Couldn't reopen this decision.");
    } finally {
      setReopening(false);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    const text = draftNote.trim();
    if (!text) return;
    setPostingNote(true);
    setNoteError(null);
    try {
      const res = await fetch(`/api/v2/trips/${tripId}/decisions/${decisionId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The draft stays in the box so nothing typed is lost.
        setNoteError(data.error ?? "Couldn't post that note.");
        return;
      }
      setNotes((list) => [...list, { ...data.note, who: "You" }]);
      setDraftNote("");
    } catch {
      setNoteError("Couldn't post that note.");
    } finally {
      setPostingNote(false);
    }
  }

  return (
    <div className="mx-auto max-w-[940px] px-6 py-12 pb-30">
      <div className="mb-3.5 flex items-center gap-3">
        <span className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">
          Decision &middot; {decision.status === "closed" ? "decided" : isTied ? "tied" : "open"}
        </span>
        {decision.status === "closed" && (
          <span className="rounded-full bg-[#EDF0EA] px-2.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-[#5B7357] uppercase">
            Closed
          </span>
        )}
        {isTied && (
          <span className="rounded-full bg-[#F3E9D8] px-2.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-[#8A6A2A] uppercase">
            Tied
          </span>
        )}
      </div>
      <h1 className="mb-3 text-[40px] leading-[1.08] font-display tracking-tight text-ink">
        {decision.title}
      </h1>
      {decision.why && (
        <p className="mb-9 max-w-[36em] text-[16.5px] leading-relaxed text-body">{decision.why}</p>
      )}

      {decision.kind === "stay" && initialComparison ? (
        <StayMatrix
          tripId={tripId}
          decisionId={decisionId}
          initial={initialComparison}
          isOpen={isOpen}
          decidedOptionId={decision.decided_option_id}
          myUserId={myUserId}
          totalMembers={totalMembers}
          onVote={castVote}
          isTied={isTied}
          isOwner={isOwner}
          onDecide={decideWinner}
          onOptionsChange={(opts) =>
            setStayOptionLabels(Object.fromEntries(opts.map((o) => [o.id, o.label])))
          }
        />
      ) : (
      <div className="mb-8.5 flex flex-wrap gap-4">
        {options.map((o) => {
          const voters = optionVotes[o.id] ?? [];
          const isMine = myVote === o.id;
          const isDecided = decision.decided_option_id === o.id;
          const isTiedLeader = isTied && tieLeaders.some((l) => l.id === o.id);
          return (
            <div
              key={o.id}
              className="min-w-[260px] flex-1 rounded-2xl border p-5.5"
              style={{
                borderColor: isDecided ? "#6E8C6A" : isTiedLeader ? "#C9A227" : isMine ? "#1B1917" : "#E4DED2",
                background: isDecided ? "#F2F7F0" : isTiedLeader ? "#FBF3DE" : "#FFFDF9",
              }}
            >
              <div className="mb-4.5 flex items-start justify-between gap-4">
                <div>
                  <div className="font-display text-[26px] leading-[1.15] text-ink">{o.label}</div>
                  {o.sub && <div className="mt-1 text-[13.5px] text-muted">{o.sub}</div>}
                </div>
                {o.cost && (
                  <div className="font-mono text-[14px] whitespace-nowrap text-[#2B2825]">
                    {o.cost}
                  </div>
                )}
              </div>

              <div className="mb-4.5 flex items-center gap-3 border-y border-[#EDE4D4] py-3">
                <div className="flex pl-1">
                  {voters.slice(0, 5).map((v, i) => (
                    <div
                      key={i}
                      className="ml-[-6px] flex h-6.5 w-6.5 items-center justify-center rounded-full border-2 border-card text-[10px] text-cream"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                      title={v.label}
                    >
                      {initialsOf(v.label)}
                    </div>
                  ))}
                </div>
                <div className="text-[13.5px] text-muted">
                  {voters.length} of {totalMembers} voted
                </div>
              </div>

              {(o.fors.length > 0 || o.against.length > 0) && (
                <div className="mb-4 flex flex-col gap-2">
                  {o.fors.map((f, i) => (
                    <div key={`f-${i}`} className="flex gap-2.5 text-[14.5px] leading-relaxed text-[#2B2825]">
                      <span className="text-[#6E8C6A]">+</span>
                      <span>{f}</span>
                    </div>
                  ))}
                  {o.against.map((a, i) => (
                    <div key={`a-${i}`} className="flex gap-2.5 text-[14.5px] leading-relaxed text-muted">
                      <span className="text-[#B4664A]">&minus;</span>
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              )}

              {isOpen ? (
                <button
                  onClick={() => castVote(o.id)}
                  disabled={voting}
                  className={`w-full rounded-full px-5 py-3 text-[15px] transition-colors disabled:opacity-60 ${
                    isMine ? "bg-ink text-cream" : "border border-input-border bg-card text-ink hover:border-ink"
                  }`}
                >
                  {isMine ? "Your pick" : "Vote for this"}
                </button>
              ) : isTied ? (
                isOwner ? (
                  <button
                    onClick={() => decideWinner(o.id)}
                    disabled={deciding}
                    className="w-full rounded-full bg-[#C9A227] px-5 py-3 text-center text-[15px] text-cream transition-colors hover:bg-[#B6911E] disabled:opacity-60"
                  >
                    {deciding ? "Picking…" : isTiedLeader ? "Pick this to settle the tie" : "Pick this instead"}
                  </button>
                ) : (
                  isTiedLeader && (
                    <div className="rounded-full bg-[#F3E9D8] px-5 py-3 text-center text-[15px] text-[#8A6A2A]">
                      Tied for the top
                    </div>
                  )
                )
              ) : (
                isDecided && (
                  <div className="rounded-full bg-[#6E8C6A] px-5 py-3 text-center text-[15px] text-cream">
                    Decided
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
      )}

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(300px,1.5fr)_minmax(220px,0.85fr)]">
        <div>
          <div className="mb-4.5 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
            Notes on this decision
          </div>
          <div className="flex flex-col gap-4.5">
            {notes.map((n) => (
              <div key={n.id} className="flex gap-3">
                <div
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] text-cream"
                  style={{ background: "#8A5A7A" }}
                >
                  {initialsOf(n.who)}
                </div>
                <div className="text-[15px] leading-relaxed text-[#2B2825]">
                  <span className="text-muted">{n.who}</span> {n.text}
                </div>
              </div>
            ))}
            <form onSubmit={addNote} className="flex items-center gap-3 border-t border-[#EDE8DD] pt-4.5">
              <input
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder="Say why, so nobody re-argues it later"
                className="flex-1 rounded-full border border-input-border bg-card px-4 py-2.5 text-[14.5px] text-ink outline-none focus:border-ink"
              />
              <button
                type="submit"
                disabled={postingNote || !draftNote.trim()}
                className="rounded-full bg-ink px-4.5 py-2.5 text-[13.5px] text-cream hover:bg-accent disabled:opacity-50"
              >
                Post
              </button>
            </form>
            {noteError && <p className="text-[13px] text-red-700">{noteError}</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5.5">
          {isOpen ? (
            <>
              <div className="mb-1.5 text-[14.5px] text-[#2B2825]">
                {totalVotes} of {totalMembers} have voted
              </div>
              <div className="mb-4.5 text-[13.5px] leading-relaxed text-muted">
                {waitingOn.length > 0
                  ? `Waiting on ${waitingOn.join(", ")}.`
                  : "Everyone's voted."}
              </div>
              <button
                onClick={closeDecision}
                disabled={closing || totalVotes === 0}
                className="w-full rounded-full border border-input-border bg-card px-5 py-2.5 text-[14px] text-ink hover:border-ink disabled:opacity-50"
              >
                {closing ? "Closing…" : "Close this decision"}
              </button>
              {error && <p className="mt-3 text-[13px] text-red-700">{error}</p>}
            </>
          ) : isTied ? (
            <div className="text-[14px] leading-relaxed text-body">
              <p className="mb-3">
                It&rsquo;s a tie between{" "}
                <span className="text-ink">{tieLeaders.map((l) => l.label).join(" and ")}</span>.
                {isOwner ? " Pick one above to settle it, or reopen to keep voting." : " Waiting on the trip owner to pick, or someone can reopen it to keep voting."}
              </p>
              <button
                onClick={reopenDecision}
                disabled={reopening}
                className="w-full rounded-full border border-input-border bg-card px-5 py-2.5 text-[14px] text-ink hover:border-ink disabled:opacity-50"
              >
                {reopening ? "Reopening…" : "Reopen to keep voting"}
              </button>
              {error && <p className="mt-3 text-[13px] text-red-700">{error}</p>}
            </div>
          ) : (
            <div className="text-[14px] leading-relaxed text-body">
              This decision is closed. The group went with{" "}
              <span className="text-ink">
                {(decision.decided_option_id && stayOptionLabels[decision.decided_option_id]) ??
                  options.find((o) => o.id === decision.decided_option_id)?.label ??
                  "an option"}
              </span>
              .
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
