"use client";

import Link from "next/link";
import { useState } from "react";
import { StayMatrix, type StayComparisonData } from "./decisions/[decisionId]/StayMatrix";
import { NewDecisionModal } from "./decisions/NewDecisionModal";

export interface StayDecisionSummary {
  id: string;
  title: string;
  status: "open" | "closed";
  deadline: string | null;
  decidedOptionLabel: string | null;
  comparison: StayComparisonData;
}

function AlreadyBookedForm({ tripId, onDone }: { tripId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);

    const decisionRes = await fetch(`/api/v2/trips/${tripId}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Where we stay", kind: "stay" }),
    });
    const decisionData = await decisionRes.json().catch(() => ({}));
    if (!decisionRes.ok) {
      setPending(false);
      setError(decisionData.error ?? "Could not save the booking.");
      return;
    }
    const decisionId = decisionData.decision.id;

    const optionRes = await fetch(`/api/v2/trips/${tripId}/decisions/${decisionId}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: name.trim().slice(0, 120),
        total_cost: cost.trim() ? Number(cost) : undefined,
        currency: cost.trim() ? currency : undefined,
        location_note: note.trim() || undefined,
      }),
    });
    if (!optionRes.ok) {
      const data = await optionRes.json().catch(() => ({}));
      setPending(false);
      setError(data.error ?? "Could not save the booking.");
      return;
    }

    await fetch(`/api/v2/trips/${tripId}/decisions/${decisionId}/close`, { method: "POST" });
    setPending(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5.5">
      <div>
        <p className="mb-1.5 font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Where</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="Casa do Prado"
          className="w-full rounded-full border border-input-border bg-card px-4 py-2 text-[14.5px] text-ink outline-none focus:border-ink"
        />
      </div>
      <div className="flex gap-2.5">
        <div className="flex-1">
          <p className="mb-1.5 font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Total cost</p>
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            inputMode="decimal"
            placeholder="1296"
            className="w-full rounded-full border border-input-border bg-card px-4 py-2 text-[14.5px] text-ink outline-none focus:border-ink"
          />
        </div>
        <div>
          <p className="mb-1.5 font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Currency</p>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-full border border-input-border bg-card px-3 py-2 text-[14.5px] text-ink outline-none focus:border-ink"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>
      <div>
        <p className="mb-1.5 font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Note (optional)</p>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Check-in at 3pm, self check-in code sent by email"
          className="w-full rounded-full border border-input-border bg-card px-4 py-2 text-[14.5px] text-ink outline-none focus:border-ink"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-full bg-ink px-5 py-2.5 text-[14px] text-cream hover:bg-accent disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add the booking"}
        </button>
        {error && <span className="text-[13px] text-red-700">{error}</span>}
      </div>
    </form>
  );
}

export function StaysSection({
  tripId,
  stayDecision,
  myUserId,
  totalMembers,
}: {
  tripId: string;
  stayDecision: StayDecisionSummary | null;
  myUserId: string;
  totalMembers: number;
}) {
  const decision = stayDecision;
  const [startOpen, setStartOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);

  // StayMatrix owns its own comparison state after this — it refetches
  // the comparison endpoint itself once the vote lands, so this just
  // needs to make the write.
  async function castVote(optionId: string) {
    if (!decision) return;
    await fetch(`/api/v2/trips/${tripId}/decisions/${decision.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: optionId }),
    });
  }

  return (
    <div id="stays" className="mb-14">
      <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
        <span className="font-mono text-[11px] text-faint">05</span>
        <span className="text-[25px] font-display text-ink">Where we stay</span>
        {decision && decision.status === "open" && (
          <span className="ml-auto text-[13.5px] text-muted">
            {decision.comparison.options.length} option{decision.comparison.options.length === 1 ? "" : "s"} &middot;{" "}
            {totalMembers} people staying
            {decision.deadline ? ` · Decision closing ${new Date(decision.deadline).toLocaleDateString(undefined, { weekday: "short" })}` : ""}
          </span>
        )}
      </div>

      {!decision ? (
        bookingOpen ? (
          <AlreadyBookedForm tripId={tripId} onDone={() => window.location.reload()} />
        ) : (
          <>
            <p className="mb-5 text-[15px] text-body">
              Nobody has to compare anything if it&rsquo;s already booked — put it in and this section stops
              asking.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="mb-1.5 text-[17px] font-display text-ink">Compare a few options</p>
                <p className="mb-4 text-[14px] text-body">
                  Paste listing links and it&rsquo;ll pull the details for you.
                </p>
                <button
                  type="button"
                  onClick={() => setStartOpen(true)}
                  className="rounded-full bg-ink px-5 py-2.5 text-[14px] text-cream hover:bg-accent"
                >
                  Start a comparison
                </button>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="mb-1.5 text-[17px] font-display text-ink">We&rsquo;re already booked</p>
                <p className="mb-4 text-[14px] text-body">
                  Add the cost and who&rsquo;s staying so the rest of the trip can build around it.
                </p>
                <button
                  type="button"
                  onClick={() => setBookingOpen(true)}
                  className="rounded-full border border-input-border bg-card px-5 py-2.5 text-[14px] text-ink hover:border-ink"
                >
                  Add the booking
                </button>
              </div>
            </div>
          </>
        )
      ) : decision.status === "open" ? (
        <StayMatrix
          tripId={tripId}
          decisionId={decision.id}
          initial={decision.comparison}
          isOpen
          decidedOptionId={null}
          myUserId={myUserId}
          totalMembers={totalMembers}
          onVote={castVote}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-3 flex items-center gap-3">
            <span className="rounded-full bg-positive px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] text-on-accent uppercase">
              Booked
            </span>
            <p className="text-[18px] font-display text-ink">{decision.decidedOptionLabel ?? "Decided"}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/planner/trips/${tripId}/decisions/${decision.id}`}
              className="rounded-full border border-input-border bg-card px-4 py-2 text-[13.5px] text-ink hover:border-ink"
            >
              Edit
            </Link>
            <span className="text-[13px] text-muted">Comparison closed</span>
          </div>
        </div>
      )}

      <NewDecisionModal tripId={tripId} open={startOpen} onClose={() => setStartOpen(false)} initialKind="stay" />
    </div>
  );
}
