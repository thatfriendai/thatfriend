"use client";

import { useState } from "react";
import type { AmenityEntry, PlannerDecisionOption } from "@/lib/supabase/planner-types";

type Voter = { label: string };

type CandidateFields = Omit<
  PlannerDecisionOption,
  "id" | "decision_id" | "trip_id" | "position" | "created_at" | "fors" | "against" | "cost" | "sub"
>;

function formatMoney(n: number | null) {
  if (n === null) return null;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function LodgingMatrix({
  tripId,
  decisionId,
  options,
  optionVotes,
  myVote,
  isOpen,
  decidedOptionId,
  totalMembers,
  voting,
  onVote,
  onOptionAdded,
}: {
  tripId: string;
  decisionId: string;
  options: PlannerDecisionOption[];
  optionVotes: Record<string, Voter[]>;
  myVote: string | null;
  isOpen: boolean;
  decidedOptionId: string | null;
  totalMembers: number;
  voting: boolean;
  onVote: (optionId: string) => void;
  onOptionAdded: (option: PlannerDecisionOption) => void;
}) {
  const [showPaste, setShowPaste] = useState(false);
  const [url, setUrl] = useState("");
  const [candidate, setCandidate] = useState<CandidateFields | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffsOnly, setDiffsOnly] = useState(false);

  async function fetchCandidate(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/decisions/${decisionId}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't read that link.");
      return;
    }
    setCandidate(data.candidate);
  }

  async function confirmCandidate() {
    if (!candidate) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/decisions/${decisionId}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candidate),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add that option.");
      return;
    }
    onOptionAdded(data.option);
    setShowPaste(false);
    setUrl("");
    setCandidate(null);
  }

  const prices = options.map((o) => o.price_per_person_night).filter((n): n is number => n !== null);
  const cheapest = prices.length > 0 ? Math.min(...prices) : null;

  const rowIsUniform = (values: (string | number | null)[]) =>
    values.every((v) => v === values[0]);

  const showPriceRow =
    !diffsOnly || !rowIsUniform(options.map((o) => o.price_per_person_night));
  const showSharingRow = !diffsOnly || !rowIsUniform(options.map((o) => o.sharing_note));
  const showLocationRow =
    !diffsOnly || !rowIsUniform(options.map((o) => o.neighborhood));

  return (
    <div className="mb-8.5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {isOpen && (
          <button
            type="button"
            onClick={() => setShowPaste((v) => !v)}
            className="rounded-full bg-ink px-5 py-2.5 text-[13.5px] text-cream hover:bg-accent"
          >
            Paste a link
          </button>
        )}
        {options.length > 1 && (
          <button
            type="button"
            onClick={() => setDiffsOnly((v) => !v)}
            className={`rounded-full border px-4 py-2 text-[13px] ${
              diffsOnly ? "border-ink bg-[#F0EBE1] text-ink-soft" : "border-input-border bg-card text-body"
            }`}
          >
            Differences only
          </button>
        )}
      </div>

      {showPaste && (
        <div className="mb-6 rounded-xl border border-input-border bg-card p-4.5">
          {!candidate ? (
            <form onSubmit={fetchCandidate} className="flex items-center gap-2.5">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste an Airbnb/hotel listing link"
                autoFocus
                className="flex-1 rounded-full border border-input-border bg-cream px-4 py-2.5 text-[14.5px] text-ink outline-none focus:border-ink"
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-ink px-4.5 py-2.5 text-[13.5px] text-cream hover:bg-accent disabled:opacity-50"
              >
                {pending ? "Reading…" : "Read it"}
              </button>
            </form>
          ) : (
            <div>
              <p className="mb-3 text-[13px] text-muted">
                Pulled from the link — check it over, then add it.
              </p>
              {candidate.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={candidate.photo_url}
                  alt=""
                  className="mb-3 h-[110px] w-full rounded-lg border border-input-border object-cover"
                />
              )}
              <div className="mb-3 flex flex-wrap gap-2.5">
                <input
                  value={candidate.label}
                  onChange={(e) => setCandidate({ ...candidate, label: e.target.value })}
                  placeholder="Name"
                  className="flex-1 rounded-lg border border-input-border bg-cream px-3.5 py-2 text-[14px] text-ink outline-none focus:border-ink"
                />
                <input
                  value={candidate.option_type ?? ""}
                  onChange={(e) => setCandidate({ ...candidate, option_type: e.target.value || null })}
                  placeholder="Type (Airbnb · Entire home)"
                  className="w-56 rounded-lg border border-input-border bg-cream px-3.5 py-2 text-[13.5px] text-ink outline-none focus:border-ink"
                />
              </div>
              <div className="mb-3 flex flex-wrap gap-2.5">
                <input
                  type="number"
                  value={candidate.price_per_person_night ?? ""}
                  onChange={(e) =>
                    setCandidate({
                      ...candidate,
                      price_per_person_night: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Per person / night"
                  className="w-40 rounded-lg border border-input-border bg-cream px-3.5 py-2 text-[13.5px] text-ink outline-none focus:border-ink"
                />
                <input
                  type="number"
                  value={candidate.total_price ?? ""}
                  onChange={(e) =>
                    setCandidate({ ...candidate, total_price: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="Total price"
                  className="w-32 rounded-lg border border-input-border bg-cream px-3.5 py-2 text-[13.5px] text-ink outline-none focus:border-ink"
                />
                <input
                  value={candidate.sharing_note ?? ""}
                  onChange={(e) => setCandidate({ ...candidate, sharing_note: e.target.value || null })}
                  placeholder="Sleeping arrangement"
                  className="flex-1 rounded-lg border border-input-border bg-cream px-3.5 py-2 text-[13.5px] text-ink outline-none focus:border-ink"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={confirmCandidate}
                  disabled={pending || !candidate.label.trim()}
                  className="rounded-full bg-ink px-5 py-2.5 text-[13.5px] text-cream hover:bg-accent disabled:opacity-50"
                >
                  {pending ? "Adding…" : "Add to the comparison"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCandidate(null);
                    setUrl("");
                  }}
                  className="text-[13px] text-muted hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {error && <p className="mt-3 text-[13px] text-red-700">{error}</p>}
        </div>
      )}

      {options.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-input-border p-7 text-center">
          <p className="mb-1.5 font-display text-xl text-ink">No options yet</p>
          <p className="text-[15px] text-body">Paste a listing link above to start comparing.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <div
            className="grid min-w-max"
            style={{ gridTemplateColumns: `160px repeat(${options.length}, minmax(200px, 1fr))` }}
          >
            <div className="border-b border-border" />
            {options.map((o) => {
              const isDecided = decidedOptionId === o.id;
              return (
                <div
                  key={o.id}
                  className="border-b border-l border-border p-4"
                  style={{ background: isDecided ? "#F2F7F0" : "#FBF6EC" }}
                >
                  {o.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.photo_url}
                      alt=""
                      className="mb-2.5 h-[90px] w-full rounded-lg border border-warm-border object-cover"
                    />
                  )}
                  <div className="mb-1 text-[14.5px] font-medium leading-tight text-ink">{o.label}</div>
                  {o.option_type && (
                    <div className="font-mono text-[9.5px] tracking-[0.08em] text-faint uppercase">
                      {o.option_type}
                    </div>
                  )}
                </div>
              );
            })}

            {showPriceRow && (
              <>
                <div className="border-b border-border bg-[#FCFAF5] px-4 py-3.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
                  Per person / night
                </div>
                {options.map((o) => {
                  const isCheapest = o.price_per_person_night !== null && o.price_per_person_night === cheapest;
                  return (
                    <div key={o.id} className="border-b border-l border-border px-4 py-3.5">
                      <div
                        className="text-[18px] font-medium"
                        style={{ color: isCheapest ? "#6E8C6A" : "#1B1917" }}
                      >
                        {formatMoney(o.price_per_person_night) ?? "—"}
                        {isCheapest ? " ↓" : ""}
                      </div>
                      {o.total_price !== null && (
                        <div className="mt-0.5 text-[11.5px] text-muted">
                          {formatMoney(o.total_price)} total
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {showSharingRow && (
              <>
                <div className="border-b border-border bg-[#FCFAF5] px-4 py-3.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
                  Who shares
                </div>
                {options.map((o) => (
                  <div key={o.id} className="border-b border-l border-border px-4 py-3.5 text-[13.5px] text-[#2B2825]">
                    {[o.bedrooms ? `${o.bedrooms} bed` : null, o.bathrooms ? `${o.bathrooms} bath` : null]
                      .filter(Boolean)
                      .join(", ") || "—"}
                    {o.sharing_note && <div className="mt-1 text-[11.5px] text-muted">{o.sharing_note}</div>}
                  </div>
                ))}
              </>
            )}

            <div className="border-b border-border bg-[#FCFAF5] px-4 py-3.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
              Amenities
            </div>
            {options.map((o) => (
              <div key={o.id} className="border-b border-l border-border px-4 py-3.5 text-[12.5px] leading-[1.7]">
                {o.amenities.length === 0 ? (
                  <span className="text-faint">—</span>
                ) : (
                  o.amenities.map((a: AmenityEntry, i: number) => (
                    <div key={i} style={{ color: a.available ? "#2B2825" : "#C4BCAE" }}>
                      {a.label}
                    </div>
                  ))
                )}
              </div>
            ))}

            {showLocationRow && (
              <>
                <div className="border-b border-border bg-[#FCFAF5] px-4 py-3.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
                  Location
                </div>
                {options.map((o) => (
                  <div key={o.id} className="border-b border-l border-border px-4 py-3.5 text-[13.5px] text-[#2B2825]">
                    {o.neighborhood ?? "—"}
                    {o.location_note && <div className="mt-1 text-[11.5px] text-muted">{o.location_note}</div>}
                  </div>
                ))}
              </>
            )}

            <div className="px-4 py-4 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">Votes</div>
            {options.map((o) => {
              const voters = optionVotes[o.id] ?? [];
              const isMine = myVote === o.id;
              const isDecided = decidedOptionId === o.id;
              return (
                <div key={o.id} className="border-l border-border px-4 py-4">
                  <div className="mb-2.5 text-[12.5px] text-muted">
                    {voters.length} of {totalMembers} voted
                  </div>
                  {isOpen ? (
                    <button
                      onClick={() => onVote(o.id)}
                      disabled={voting}
                      className={`w-full rounded-full px-4 py-2.5 text-[13.5px] transition-colors disabled:opacity-60 ${
                        isMine ? "bg-ink text-cream" : "border border-input-border bg-card text-ink hover:border-ink"
                      }`}
                    >
                      {isMine ? "Your pick" : "Vote for this"}
                    </button>
                  ) : (
                    isDecided && (
                      <div className="rounded-full bg-[#6E8C6A] px-4 py-2.5 text-center text-[13.5px] text-cream">
                        Decided
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
