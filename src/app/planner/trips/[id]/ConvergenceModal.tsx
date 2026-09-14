"use client";

import { useState } from "react";
import type { ConvergenceOverlap, ClusterCount } from "@/lib/planner/convergence";
import { DAY_COLORS } from "@/lib/planner/itinerary";

const DOT_COLORS = DAY_COLORS;

interface ConvergencePayload {
  answered: number;
  total: number;
  privacy: string;
  overlaps: ConvergenceOverlap[];
  clusters: ClusterCount[];
  reads: { head: string; body: string }[];
}

function OverlapBar({ overlap }: { overlap: ConvergenceOverlap }) {
  const pct = (v: number) => Math.min(98, (v / overlap.max) * 100);
  const floorPct = pct(overlap.floor);
  const comfyPct = pct(overlap.comfy);

  const seen = new Map<number, number>();
  const positioned = overlap.dots.map((d) => {
    const tie = seen.get(d.value) ?? 0;
    seen.set(d.value, tie + 1);
    const nudge = tie * 24 * (pct(d.value) > 60 ? -1 : 1);
    return { ...d, left: pct(d.value), nudge };
  });

  return (
    <div>
      <p className="mb-4 text-[15.5px] text-ink-body">{overlap.label}</p>
      <div className="relative">
        <div className="relative h-8.5 overflow-hidden rounded-lg border border-border-soft bg-card">
          <div
            className="absolute top-0 bottom-0 left-0 border-r-2 border-positive bg-positive/15"
            style={{ width: `${floorPct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 bg-accent/20"
            style={{ left: `${floorPct}%`, width: `${Math.max(0, comfyPct - floorPct)}%` }}
          />
        </div>
        {positioned.map((d, i) => (
          <div
            key={i}
            className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 border-card text-[9.5px] text-cream shadow"
            style={{
              left: `calc(${d.left}% + ${d.nudge}px)`,
              transform: "translate(-50%, -50%)",
              background: DOT_COLORS[i % DOT_COLORS.length],
            }}
          >
            {d.name ? d.name.slice(0, 2).toUpperCase() : ""}
          </div>
        ))}
      </div>
      <div className="mt-5 flex gap-5 text-[13.5px]">
        <div className="flex items-center gap-1.5 text-body">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-positive" />${overlap.floor} works for all{" "}
          {overlap.dots.length}
        </div>
        <div className="flex items-center gap-1.5 text-muted">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-accent/40" />${overlap.comfy} works for most
        </div>
      </div>
    </div>
  );
}

export function ConvergenceModal({
  tripId,
  tripName,
  hasAnsweredPreferences,
}: {
  tripId: string;
  tripName: string;
  hasAnsweredPreferences: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ConvergencePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openModal() {
    setOpen(true);
    if (!hasAnsweredPreferences) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/convergence`);
    setLoading(false);
    if (!res.ok) {
      setError("Could not load this.");
      return;
    }
    setData(await res.json());
  }

  const isPrivate = data?.privacy === "private";

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[13px] text-ink hover:border-ink"
      >
        Where we landed
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-10"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[820px] rounded-2xl border border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-soft px-7 py-4">
              <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
                {data ? `${data.answered} of ${data.total} answered` : tripName}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex-none rounded-full border border-input-border bg-card px-2.5 py-1 text-[13px] text-muted hover:border-ink hover:text-ink"
              >
                Close
              </button>
            </div>

            <div className="px-7 py-7 sm:px-9">
              {!hasAnsweredPreferences && (
                <div className="rounded-2xl border border-warm-border bg-warm-bg p-6.5">
                  <p className="mb-1.5 text-xl font-display text-ink">Answer your preferences first</p>
                  <p className="mb-4 text-[15px] text-body">
                    Where everyone landed is built from what people answered — add yours to see it.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      window.dispatchEvent(new CustomEvent("open-preferences-modal"));
                    }}
                    className="rounded-full bg-ink px-5.5 py-2.5 text-[14.5px] text-cream hover:bg-accent"
                  >
                    Add my preferences
                  </button>
                </div>
              )}

              {hasAnsweredPreferences && loading && <p className="text-[14.5px] text-muted">Loading…</p>}
              {error && <p className="text-[14.5px] text-red-700">{error}</p>}

              {hasAnsweredPreferences && data && (
                <>
                  <h2 className="mb-3 text-[32px] leading-[1.08] font-display tracking-tight text-ink">
                    {data.answered >= data.total && data.answered > 0
                      ? "Here’s what everyone landed on."
                      : "Here’s where we landed so far."}
                  </h2>
                  <p className="mb-9 max-w-xl text-[15.5px] leading-relaxed text-body">
                    {isPrivate
                      ? "Nobody saw anyone else’s numbers while they answered. This is the overlap, which is the only part that matters."
                      : "Everyone could see each other’s numbers as they answered. This is the overlap, which is the only part that matters."}
                  </p>

                  {data.overlaps.length > 0 ? (
                    <>
                      <p className="mb-5 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
                        What everyone can spend
                      </p>
                      <div className="mb-5 flex flex-col gap-7.5">
                        {data.overlaps.map((o) => (
                          <OverlapBar key={o.key} overlap={o} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted">Nobody&rsquo;s answered yet.</p>
                  )}

                  <div className="my-9 border-t border-border" />

                  <div className="grid grid-cols-1 items-start gap-9 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1.15fr)]">
                    <div>
                      <p className="mb-5 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
                        What people want
                      </p>
                      <div className="flex flex-col gap-4">
                        {data.clusters.length === 0 && (
                          <p className="text-sm text-muted">No interests picked yet.</p>
                        )}
                        {data.clusters.map((c) => (
                          <div key={c.label}>
                            <div className="mb-1.5 flex items-baseline justify-between">
                              <span className="text-[14.5px] text-ink-body">{c.label}</span>
                              <span className="font-mono text-[11.5px] text-muted">
                                {c.count} of {c.total}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-border-soft">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${(c.count / Math.max(1, c.total)) * 100}%`,
                                  background:
                                    c.count / c.total >= 0.66
                                      ? "var(--color-positive)"
                                      : c.count / c.total >= 0.5
                                        ? "var(--color-caution)"
                                        : "var(--color-ink-ghost)",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-5 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
                        So here&rsquo;s the shape of it
                      </p>
                      <div className="flex flex-col gap-5">
                        {data.reads.length === 0 && (
                          <p className="text-sm text-muted">Reads will show up once a few more people answer.</p>
                        )}
                        {data.reads.map((r, i) => (
                          <div key={i}>
                            <p className="mb-1.5 text-xl leading-tight font-display text-ink">{r.head}</p>
                            <p className="text-[14.5px] leading-relaxed text-body">{r.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-9 border-t border-border pt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        window.dispatchEvent(new CustomEvent("open-preferences-modal"));
                      }}
                      className="text-sm text-body underline hover:text-accent"
                    >
                      Change my answers
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
