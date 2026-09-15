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

type LocationMatch = { address: string; lat: number; lng: number };

function AlreadyBookedForm({ tripId, onDone }: { tripId: string; onDone: () => void }) {
  const [kind, setKind] = useState<"hotel" | "other">("hotel");
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hotel names resolve to a real address via Google; a private
  // Airbnb/friend's-place listing has no public address to look up, so
  // that branch just asks for it directly instead of pretending to search.
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "found" | "none">("idle");
  const [match, setMatch] = useState<LocationMatch | null>(null);
  const [manualAddress, setManualAddress] = useState("");

  async function lookUp() {
    if (!name.trim()) return;
    setLookupStatus("loading");
    const res = await fetch(`/api/v2/trips/${tripId}/geocode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: name.trim() }),
    });
    const data = await res.json().catch(() => ({ match: null }));
    if (data.match) {
      setMatch(data.match);
      setLookupStatus("found");
    } else {
      setMatch(null);
      setLookupStatus("none");
    }
  }

  function differentAddress() {
    setMatch(null);
    setLookupStatus("none");
  }

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

    const locationNote = match?.address || manualAddress.trim() || undefined;

    const optionRes = await fetch(`/api/v2/trips/${tripId}/decisions/${decisionId}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: name.trim().slice(0, 120),
        total_cost: cost.trim() ? Number(cost) : undefined,
        currency: cost.trim() ? currency : undefined,
        location_note: locationNote,
        lat: match?.lat,
        lng: match?.lng,
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
      <div className="mb-1 flex border-b border-border">
        {([
          { key: "hotel" as const, label: "A hotel" },
          { key: "other" as const, label: "Airbnb or a friend’s place" },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setKind(t.key);
              setMatch(null);
              setLookupStatus("idle");
              setManualAddress("");
            }}
            className="flex-1 pb-2.5 text-center text-[15px]"
            style={{
              color: kind === t.key ? "#1B1917" : "var(--color-muted)",
              borderBottom: kind === t.key ? "2px solid #1B1917" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-1.5 font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">
          {kind === "hotel" ? "Hotel name" : "What is it"}
        </p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setMatch(null);
              setLookupStatus("idle");
            }}
            autoFocus
            placeholder={kind === "hotel" ? "Georges Hotel Galata" : "Airbnb · Ferhan’s place"}
            className="w-full rounded-full border border-input-border bg-card px-4 py-2 text-[17px] text-ink outline-none focus:border-ink"
          />
          {kind === "hotel" && (
            <button
              type="button"
              onClick={lookUp}
              disabled={!name.trim() || lookupStatus === "loading"}
              className="flex-none rounded-full border border-input-border px-4 py-2 text-[14px] text-ink-body hover:border-ink disabled:opacity-50"
            >
              {lookupStatus === "loading" ? "Looking…" : "Look it up"}
            </button>
          )}
        </div>

        {kind === "hotel" && lookupStatus === "found" && match && (
          <div className="mt-2.5 rounded-xl border border-[#E8DFD0] bg-[#FBF6EC] px-4.5 py-4">
            <p className="mb-2 font-mono text-[10.5px] tracking-[0.08em] text-muted uppercase">
              We found this address
            </p>
            <p className="mb-1 text-[17px] text-ink">{match.address}</p>
            <p className="mb-3.5 text-[14.5px] text-body">
              Confirm it and every walking time in the trip gets measured from this door.
            </p>
            <div className="flex gap-2">
              <span className="rounded-full bg-ink px-4 py-1.5 text-[14px] text-cream">That&rsquo;s the one</span>
              <button
                type="button"
                onClick={differentAddress}
                className="rounded-full border border-input-border px-4 py-1.5 text-[14px] text-ink-body hover:border-ink"
              >
                Different address
              </button>
            </div>
          </div>
        )}

        {kind === "hotel" && lookupStatus === "none" && (
          <div className="mt-2.5">
            <p className="mb-1.5 text-[13.5px] text-muted">
              Couldn&rsquo;t find that one &mdash; paste the address instead.
            </p>
            <input
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="Serdar-ı Ekrem Cd. 24, Galata, Istanbul"
              className="w-full rounded-full border border-input-border bg-card px-4 py-2 text-[14.5px] text-ink outline-none focus:border-ink"
            />
          </div>
        )}

        {kind === "other" && (
          <div className="mt-2.5 rounded-xl border border-dashed border-[#C9A0B8] bg-[#FAF0F6] px-4.5 py-4">
            <p className="mb-2 font-mono text-[10.5px] tracking-[0.08em] text-muted uppercase">
              We need the address
            </p>
            <p className="mb-3.5 text-[14.5px] text-body">
              Private listings have no public address, so paste the one in your booking email.
            </p>
            <input
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="Paste the address"
              className="w-full rounded-full border border-input-border bg-card px-4 py-2 text-[14.5px] text-ink outline-none focus:border-ink"
            />
          </div>
        )}
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
          className="rounded-full bg-ink px-5 py-2.5 text-[17px] text-cream hover:bg-accent disabled:opacity-50"
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
        <span className="font-mono text-[11px] text-faint">04</span>
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
                <p className="mb-4 text-[17px] text-body">
                  Paste listing links and it&rsquo;ll pull the details for you.
                </p>
                <button
                  type="button"
                  onClick={() => setStartOpen(true)}
                  className="rounded-full bg-ink px-5 py-2.5 text-[17px] text-cream hover:bg-accent"
                >
                  Start a comparison
                </button>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="mb-1.5 text-[17px] font-display text-ink">We&rsquo;re already booked</p>
                <p className="mb-4 text-[17px] text-body">
                  Add the cost and who&rsquo;s staying so the rest of the trip can build around it.
                </p>
                <button
                  type="button"
                  onClick={() => setBookingOpen(true)}
                  className="rounded-full border border-input-border bg-card px-5 py-2.5 text-[17px] text-ink hover:border-ink"
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
            <span className="rounded-full bg-positive px-2.5 py-1 font-mono text-[10.5px] tracking-[0.08em] text-on-accent uppercase">
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
