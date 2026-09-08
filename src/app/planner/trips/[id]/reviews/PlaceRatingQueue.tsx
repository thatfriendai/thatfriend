"use client";

import { useState } from "react";
import type { VisitedPlace } from "@/lib/planner/ratingCapture";

interface MyRating {
  rating: number;
  body: string | null;
}

interface OtherRating {
  who: string;
  rating: number;
}

export function PlaceRatingQueue({
  tripId,
  visits,
  initialMyRatings,
  othersByPlace,
  showSocialProof,
}: {
  tripId: string;
  visits: VisitedPlace[];
  initialMyRatings: Record<string, MyRating>;
  othersByPlace: Record<string, OtherRating[]>;
  showSocialProof: boolean;
}) {
  const [myRatings, setMyRatings] = useState(initialMyRatings);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const firstOpenIndex = visits.findIndex((v) => !myRatings[v.id] && !skipped.has(v.id));
  const [index, setIndex] = useState(firstOpenIndex === -1 ? visits.length : firstOpenIndex);
  const [draftRating, setDraftRating] = useState(0);
  const [draftBody, setDraftBody] = useState("");
  const [saving, setSaving] = useState(false);

  const ratedCount = visits.filter((v) => myRatings[v.id]).length;
  const current = index < visits.length ? visits[index] : null;

  function advance() {
    setDraftRating(0);
    setDraftBody("");
    let next = index + 1;
    while (next < visits.length && (myRatings[visits[next].id] || skipped.has(visits[next].id))) next++;
    setIndex(next);
  }

  async function submit() {
    if (!current || draftRating < 1) return;
    setSaving(true);
    const res = await fetch(`/api/v2/trips/${tripId}/places/${current.id}/rating`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: draftRating, body: draftBody.trim() || undefined }),
    });
    setSaving(false);
    if (!res.ok) return;
    setMyRatings((m) => ({ ...m, [current.id]: { rating: draftRating, body: draftBody.trim() || null } }));
    advance();
  }

  function skip() {
    if (!current) return;
    setSkipped((s) => new Set(s).add(current.id));
    advance();
  }

  if (visits.length === 0) return null;

  return (
    <div className="mb-12">
      <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
        <span className="font-mono text-[11px] text-faint">00</span>
        <span className="text-[25px] font-display text-ink">Rate the places</span>
        <span className="ml-auto text-[13.5px] text-muted">
          {ratedCount} of {visits.length} rated
        </span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-border-soft">
        <div
          className="h-full bg-positive transition-all"
          style={{ width: `${visits.length > 0 ? (ratedCount / visits.length) * 100 : 0}%` }}
        />
      </div>

      {!current ? (
        <div className="rounded-2xl border border-dashed border-input-border p-7 text-center">
          <p className="mb-1.5 font-display text-xl text-ink">
            {ratedCount === visits.length ? "All rated." : "That's everything for now."}
          </p>
          <p className="text-[15px] text-body">
            {ratedCount} of {visits.length} places rated
            {ratedCount < visits.length ? " — the rest were skipped." : "."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5.5">
          <div className="mb-4 flex items-center gap-3.5">
            {current.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.photoUrl} alt="" className="h-14 w-14 flex-none rounded-lg object-cover" />
            ) : (
              <div className="h-14 w-14 flex-none rounded-lg bg-border-soft" />
            )}
            <div>
              <p className="font-display text-xl text-ink">{current.name}</p>
              {current.dayLabel && <p className="text-[12.5px] text-muted">{current.dayLabel}</p>}
            </div>
          </div>

          {showSocialProof && (othersByPlace[current.id]?.length ?? 0) > 0 && (
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 border-b border-border-soft pb-4 text-[13px] text-muted">
              {othersByPlace[current.id].map((o, i) => (
                <span key={i}>
                  {o.who}: {"★".repeat(o.rating)}
                </span>
              ))}
            </div>
          )}

          <div className="mb-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDraftRating(n)}
                className={`text-2xl leading-none ${n <= draftRating ? "text-accent" : "text-border"}`}
                aria-label={`${n} stars`}
              >
                ★
              </button>
            ))}
          </div>
          <input
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            placeholder="A line for anyone thinking of going (optional)"
            className="mb-4 w-full rounded-full border border-input-border bg-cream px-4 py-2 text-[14px] text-ink outline-none focus:border-ink"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={saving || draftRating < 1}
              className="rounded-full bg-ink px-5 py-2.5 text-[13.5px] text-cream hover:bg-accent disabled:opacity-50"
            >
              {saving ? "Saving…" : "Rate it"}
            </button>
            <button type="button" onClick={skip} className="text-[13px] text-muted hover:text-ink">
              Skip this one
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
