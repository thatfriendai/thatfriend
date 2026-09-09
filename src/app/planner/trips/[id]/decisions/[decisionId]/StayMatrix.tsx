"use client";

import { useState } from "react";
import type { StayAmenities, StaySource } from "@/lib/supabase/planner-types";
import type { StayComparison } from "@/lib/planner/stayComparison";

export interface StayComparisonData extends StayComparison {
  read: string | null;
}

const AMENITY_ROWS: { key: keyof StayAmenities; label: string }[] = [
  { key: "kitchen", label: "Kitchen" },
  { key: "ac", label: "AC" },
  { key: "washer", label: "Washer" },
  { key: "pool", label: "Pool" },
  { key: "breakfast", label: "Breakfast" },
  { key: "wifi", label: "Wifi" },
];

interface CandidateFields {
  label: string;
  source: StaySource | null;
  url: string | null;
  image_url: string | null;
  total_cost: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds_note: string | null;
  amenities: StayAmenities;
  neighborhood: string | null;
  location_note: string | null;
}

function formatMoney(n: number | null, currency: string | null) {
  if (n === null) return null;
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  return `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function StayMatrix({
  tripId,
  decisionId,
  initial,
  isOpen,
  decidedOptionId,
  myUserId,
  totalMembers,
  onVote,
}: {
  tripId: string;
  decisionId: string;
  initial: StayComparisonData;
  isOpen: boolean;
  decidedOptionId: string | null;
  myUserId: string;
  totalMembers: number;
  onVote: (optionId: string) => Promise<void>;
}) {
  const [comparison, setComparison] = useState(initial);
  const [showPaste, setShowPaste] = useState(false);
  const [url, setUrl] = useState("");
  const [candidate, setCandidate] = useState<CandidateFields | null>(null);
  const [pending, setPending] = useState(false);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffsOnly, setDiffsOnly] = useState(false);

  const options = comparison.options;
  // All options render — past four, the row-header column stays pinned
  // (sticky left-0 below) and the rest scroll horizontally rather than
  // being dropped.
  const visibleOptions = options;
  const overflowCount = Math.max(0, options.length - 4);

  async function refresh() {
    const res = await fetch(`/api/v2/trips/${tripId}/decisions/${decisionId}/comparison`);
    if (!res.ok) return;
    const data = await res.json();
    setComparison(data);
  }

  async function castVote(optionId: string) {
    if (!isOpen || voting) return;
    setVoting(true);
    await onVote(optionId);
    await refresh();
    setVoting(false);
  }

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
    setShowPaste(false);
    setUrl("");
    setCandidate(null);
    await refresh();
  }

  const rowIsUniform = (values: unknown[]) => values.every((v) => v === values[0]);

  const showCostRow = !diffsOnly || !rowIsUniform(options.map((o) => o.per_person_per_night));
  const showSleepingRow = !diffsOnly || !rowIsUniform(options.map((o) => `${o.bedrooms}-${o.bathrooms}-${o.beds_note}`));
  const showLocationRow =
    !diffsOnly || !rowIsUniform(options.map((o) => `${o.neighborhood}-${o.walk_minutes}`));
  const showRatingRow = !diffsOnly || !rowIsUniform(options.map((o) => o.rating));
  const visibleAmenityRows = AMENITY_ROWS.filter(
    (row) => !diffsOnly || !rowIsUniform(options.map((o) => o.amenities[row.key]))
  );

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
              diffsOnly ? "border-ink bg-ink text-cream" : "border-input-border bg-card text-body"
            }`}
          >
            Differences only
          </button>
        )}
        {overflowCount > 0 && (
          <span className="text-[12.5px] text-muted">
            {overflowCount} more — scroll to see {overflowCount === 1 ? "it" : "the rest"}.
          </span>
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
                Pulled from the link — check it over, then add it. Nothing here is required.
              </p>
              {candidate.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={candidate.image_url}
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
                <select
                  value={candidate.source ?? ""}
                  onChange={(e) =>
                    setCandidate({ ...candidate, source: (e.target.value || null) as StaySource | null })
                  }
                  className="w-40 rounded-lg border border-input-border bg-cream px-3.5 py-2 text-[13.5px] text-ink outline-none focus:border-ink"
                >
                  <option value="">Type…</option>
                  <option value="airbnb">Airbnb</option>
                  <option value="hotel">Hotel</option>
                  <option value="aparthotel">Aparthotel</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="mb-3 flex flex-wrap gap-2.5">
                <input
                  type="number"
                  value={candidate.total_cost ?? ""}
                  onChange={(e) =>
                    setCandidate({ ...candidate, total_cost: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="Total cost"
                  className="w-32 rounded-lg border border-input-border bg-cream px-3.5 py-2 text-[13.5px] text-ink outline-none focus:border-ink"
                />
                <input
                  value={candidate.currency ?? ""}
                  onChange={(e) => setCandidate({ ...candidate, currency: e.target.value || null })}
                  placeholder="Currency (USD)"
                  className="w-28 rounded-lg border border-input-border bg-cream px-3.5 py-2 text-[13.5px] text-ink outline-none focus:border-ink"
                />
                <input
                  value={candidate.beds_note ?? ""}
                  onChange={(e) => setCandidate({ ...candidate, beds_note: e.target.value || null })}
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
        <>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <div
              className="grid min-w-max"
              style={{ gridTemplateColumns: `160px repeat(${visibleOptions.length}, minmax(152px, 1fr))` }}
            >
              <div className="sticky left-0 z-10 border-b border-border bg-surface-sunk" />
              {visibleOptions.map((o) => {
                const isDecided = decidedOptionId === o.id;
                return (
                  <div
                    key={o.id}
                    className="border-b border-l border-border p-4"
                    style={{ background: isDecided ? "var(--color-positive)" : "var(--color-surface-warm)", opacity: isDecided ? 0.12 : 1 }}
                  >
                    {o.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.image_url}
                        alt=""
                        className="mb-2.5 h-[90px] w-full rounded-lg border border-warm-border object-cover"
                      />
                    )}
                    {o.url ? (
                      <a
                        href={o.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-1 block text-[14.5px] font-medium leading-tight text-ink hover:text-accent"
                      >
                        {o.label}
                      </a>
                    ) : (
                      <div className="mb-1 text-[14.5px] font-medium leading-tight text-ink">{o.label}</div>
                    )}
                    {o.source && (
                      <div className="font-mono text-[9.5px] tracking-[0.08em] text-faint uppercase">{o.source}</div>
                    )}
                  </div>
                );
              })}

              {showCostRow && (
                <>
                  <div className="sticky left-0 z-10 border-b border-border bg-surface-sunk px-4 py-3.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
                    Per person / night
                  </div>
                  {visibleOptions.map((o) => (
                    <div key={o.id} className="border-b border-l border-border px-4 py-3.5">
                      <div
                        className="text-[18px] font-medium"
                        style={{ color: o.best_in.includes("cost") ? "var(--color-positive)" : "var(--color-ink)" }}
                      >
                        {formatMoney(o.per_person_per_night, o.currency ?? comparison.currency) ?? "—"}
                        {o.best_in.includes("cost") ? " ↓" : ""}
                      </div>
                      {o.total_cost !== null && (
                        <div className="mt-0.5 text-[11.5px] text-muted">
                          {formatMoney(o.total_cost, o.currency ?? comparison.currency)} total
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {showSleepingRow && (
                <>
                  <div className="sticky left-0 z-10 border-b border-border bg-surface-sunk px-4 py-3.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
                    Sleeping
                  </div>
                  {visibleOptions.map((o) => (
                    <div key={o.id} className="border-b border-l border-border px-4 py-3.5 text-[13.5px] text-ink-body">
                      <span style={{ color: o.best_in.includes("sleeping") ? "var(--color-positive)" : undefined }}>
                        {[o.bedrooms ? `${o.bedrooms} bed` : null, o.bathrooms ? `${o.bathrooms} bath` : null]
                          .filter(Boolean)
                          .join(", ") || "—"}
                        {o.best_in.includes("sleeping") ? " ↓" : ""}
                      </span>
                      {o.beds_note && <div className="mt-1 text-[11.5px] text-muted">{o.beds_note}</div>}
                    </div>
                  ))}
                </>
              )}

              {visibleAmenityRows.length > 0 && (
                <>
                  <div className="sticky left-0 z-10 border-b border-border bg-surface-sunk px-4 py-3.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
                    Amenities
                  </div>
                  {visibleOptions.map((o) => (
                    <div key={o.id} className="border-b border-l border-border px-4 py-3.5 text-[12.5px] leading-[1.7]">
                      {visibleAmenityRows.map((row) => {
                        const value = o.amenities[row.key];
                        if (value === null) {
                          // Nobody checked this one — a blank line, not a
                          // guess. Keeps the row's line count (and therefore
                          // its alignment against the other option columns)
                          // even though there's nothing to say.
                          return <div key={row.key}>&nbsp;</div>;
                        }
                        return (
                          <div
                            key={row.key}
                            className={value ? "text-ink-body" : "text-ink-ghost line-through"}
                          >
                            {value ? row.label : `No ${row.label.toLowerCase()}`}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </>
              )}

              {showLocationRow && (
                <>
                  <div className="sticky left-0 z-10 border-b border-border bg-surface-sunk px-4 py-3.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
                    Location
                  </div>
                  {visibleOptions.map((o) => (
                    <div key={o.id} className="border-b border-l border-border px-4 py-3.5 text-[13.5px] text-ink-body">
                      {o.neighborhood ?? "—"}
                      <div
                        className="mt-1 text-[11.5px]"
                        style={{ color: o.best_in.includes("location") ? "var(--color-positive)" : "var(--color-ink-muted)" }}
                      >
                        {o.walk_minutes !== null
                          ? `~${o.walk_minutes} min walk to ${o.saved_places_near} saved place${o.saved_places_near === 1 ? "" : "s"}${o.best_in.includes("location") ? " ↓" : ""}`
                          : "No saved places nearby yet"}
                      </div>
                      {o.location_note && <div className="mt-1 text-[11.5px] text-muted">{o.location_note}</div>}
                    </div>
                  ))}
                </>
              )}

              {showRatingRow && (
                <>
                  <div className="sticky left-0 z-10 border-b border-border bg-surface-sunk px-4 py-3.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
                    Rating
                  </div>
                  {visibleOptions.map((o) => (
                    <div key={o.id} className="border-b border-l border-border px-4 py-3.5 text-[13.5px] text-ink-body">
                      {o.rating !== null ? (
                        <>
                          {o.rating.toFixed(1)}
                          {o.rating_count !== null && (
                            <span className="text-muted"> ({o.rating_count})</span>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-ghost">Not rated</span>
                      )}
                    </div>
                  ))}
                </>
              )}

              <div className="sticky left-0 z-10 bg-surface-sunk px-4 py-4 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
                Votes
              </div>
              {visibleOptions.map((o) => {
                const isMine = o.votes.includes(myUserId);
                const isDecided = decidedOptionId === o.id;
                return (
                  <div key={o.id} className="border-l border-border px-4 py-4">
                    <div className="mb-2.5 text-[12.5px] text-muted">
                      {o.votes.length} of {totalMembers} voted
                    </div>
                    {isOpen ? (
                      <button
                        onClick={() => castVote(o.id)}
                        disabled={voting}
                        className={`w-full rounded-full px-4 py-2.5 text-[13.5px] transition-colors disabled:opacity-60 ${
                          isMine ? "bg-ink text-cream" : "border border-input-border bg-card text-ink hover:border-ink"
                        }`}
                      >
                        {isMine ? "Your pick" : "Vote for this"}
                      </button>
                    ) : (
                      isDecided && (
                        <div className="rounded-full bg-positive px-4 py-2.5 text-center text-[13.5px] text-on-accent">
                          Decided
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {comparison.read && (
            <div className="mt-4 rounded-xl border-t-2 border-border bg-surface-warm px-4.5 py-3.5 text-[14px] leading-relaxed text-ink-body">
              {comparison.read}
            </div>
          )}
        </>
      )}
    </div>
  );
}
