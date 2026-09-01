"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDayLabel } from "@/lib/planner/itinerary";
import { Stars } from "@/components/planner/Stars";
import { ShareItinerary } from "./ShareItinerary";
import type {
  PlannerDay,
  PlannerItemRating,
  PlannerItineraryItem,
  PlannerTripReview,
  PaceFeedback,
} from "@/lib/supabase/planner-types";

type DayWithItems = PlannerDay & { items: PlannerItineraryItem[] };
type Rating = PlannerItemRating & { who: string };

const PACE_OPTIONS: { key: PaceFeedback; label: string }[] = [
  { key: "saw_everything", label: "We saw everything we wanted" },
  { key: "about_right", label: "About right" },
  { key: "not_enough_time", label: "Not enough time" },
  { key: "too_packed", label: "Too packed" },
];

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className={`text-lg leading-none ${n <= shown ? "text-accent" : "text-border"}`}
          aria-label={`${n} stars`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ItemRatingRow({
  tripId,
  item,
  existing,
}: {
  tripId: string;
  item: PlannerItineraryItem;
  existing: Rating | undefined;
}) {
  const router = useRouter();
  const [stars, setStars] = useState(existing?.stars ?? 0);
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (stars < 1) return;
    setSaving(true);
    await fetch(`/api/v2/trips/${tripId}/itinerary/items/${item.id}/rating`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars, note }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4.5 py-4">
      <p className="mb-2.5 text-[14.5px] text-ink">{item.text}</p>
      <div className="flex items-center gap-3">
        <StarInput value={stars} onChange={setStars} />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="A line for anyone thinking of going…"
          className="min-w-0 flex-1 rounded-lg border border-input-border bg-transparent px-3 py-1.5 text-[13.5px] text-ink outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving || stars < 1}
          className="rounded-full border border-input-border bg-card px-4 py-1.5 text-[13px] text-ink hover:border-ink disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export function ReviewsBoard({
  tripId,
  tripName,
  destination,
  endDate,
  myUserId,
  days,
  ratings,
  myReview,
  shareToken,
}: {
  tripId: string;
  tripName: string;
  destination: string | null;
  endDate: string | null;
  myUserId: string;
  days: DayWithItems[];
  ratings: Rating[];
  myReview: PlannerTripReview | null;
  shareToken: string | null;
}) {
  const router = useRouter();
  const [stayRating, setStayRating] = useState(myReview?.stay_rating ?? 0);
  const [pace, setPace] = useState<PaceFeedback | null>(myReview?.pace_feedback ?? null);
  const [savingReview, setSavingReview] = useState(false);
  const [saved, setSaved] = useState(false);

  const ratingsByItem = useMemo(() => {
    const map = new Map<string, Rating[]>();
    for (const r of ratings) {
      if (!map.has(r.item_id)) map.set(r.item_id, []);
      map.get(r.item_id)!.push(r);
    }
    return map;
  }, [ratings]);

  const allItems = days.flatMap((d) => d.items);
  const myRatedItemIds = new Set(ratings.filter((r) => r.user_id === myUserId).map((r) => r.item_id));
  const unrated = allItems.filter((i) => !myRatedItemIds.has(i.id));

  async function saveReview() {
    setSavingReview(true);
    await fetch(`/api/v2/trips/${tripId}/review`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stay_rating: stayRating || null, pace_feedback: pace }),
    });
    setSavingReview(false);
    setSaved(true);
    router.refresh();
  }

  const hasEnded = endDate ? endDate < new Date().toISOString().slice(0, 10) : false;

  return (
    <div className="mx-auto max-w-[820px] px-6 py-9.5 pb-28">
      <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
        {tripName}
        {destination ? ` · ${destination}` : ""}
        {hasEnded ? " · Ended" : ""}
      </p>
      <h1 className="mb-3 text-4xl leading-[1.08] font-display tracking-tight text-ink">
        {hasEnded ? "As it actually ran." : "Rate as you go, or wait until you're back."}
      </h1>
      <p className="mb-8 max-w-xl text-base leading-relaxed text-body">
        Share this with anyone thinking of going. What the group thought of
        each place travels with it.
      </p>

      <div className="mb-12">
        <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
          <span className="font-mono text-[11px] text-[#C0B8A8]">01</span>
          <span className="text-[25px] font-display text-ink">The itinerary</span>
          <span className="ml-auto text-[13.5px] text-muted">What people see when you share it</span>
        </div>
        {allItems.length === 0 ? (
          <p className="text-[15px] text-muted">Nothing on the plan yet.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {days.filter((d) => d.items.length > 0).map((d) => (
              <div key={d.id}>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: d.color }} />
                  <span className="font-mono text-[10.5px] tracking-[0.1em] text-[#6B655C]">
                    {formatDayLabel(d.date)}
                    {d.city ? ` · ${d.city.toUpperCase()}` : ""}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {d.items.map((item) => {
                    const itemRatings = ratingsByItem.get(item.id) ?? [];
                    return (
                      <div key={item.id} className="rounded-xl border border-border-soft bg-card px-4 py-3">
                        <p className="mb-1.5 text-[14.5px] text-ink">{item.text}</p>
                        {itemRatings.length === 0 ? (
                          <p className="text-[13px] text-faint">Not rated yet</p>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {itemRatings.map((r) => (
                              <div key={r.id} className="flex items-baseline gap-2 text-[13px]">
                                <Stars value={r.stars} />
                                <span className="text-muted">{r.who}</span>
                                {r.note && <span className="text-body">&middot; {r.note}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-12">
        <p className="mb-3 text-[15px] text-body">
          A link shows the itinerary with everyone&rsquo;s ratings and
          notes on it. Budgets and preferences never travel with it.
        </p>
        <ShareItinerary tripId={tripId} initialToken={shareToken} />
      </div>

      {unrated.length > 0 && (
        <div className="mb-12">
          <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
            <span className="font-mono text-[11px] text-[#C0B8A8]">02</span>
            <span className="text-[25px] font-display text-ink">
              {unrated.length} place{unrated.length === 1 ? "" : "s"} want{unrated.length === 1 ? "s" : ""} a rating
            </span>
            <span className="ml-auto text-[13.5px] text-muted">Skip anything you&rsquo;d rather not</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {unrated.map((item) => (
              <ItemRatingRow key={item.id} tripId={tripId} item={item} existing={undefined} />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
          <span className="font-mono text-[11px] text-[#C0B8A8]">{unrated.length > 0 ? "03" : "02"}</span>
          <span className="text-[25px] font-display text-ink">The trip itself</span>
          <span className="ml-auto text-[13.5px] text-muted">Two questions, both optional</span>
        </div>
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-2 text-[15px] text-ink">Would you stay there again?</p>
            <StarInput value={stayRating} onChange={setStayRating} />
          </div>
          <div>
            <p className="mb-2.5 text-[15px] text-ink">How did the days run?</p>
            <div className="flex flex-wrap gap-2.5">
              {PACE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPace(opt.key)}
                  className={`rounded-full border px-4 py-2.5 text-sm transition-colors ${
                    pace === opt.key
                      ? "border-accent bg-accent text-cream"
                      : "border-input-border bg-card text-ink-soft hover:border-ink"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={saveReview}
              disabled={savingReview}
              className="self-start rounded-full bg-ink px-6 py-2.5 text-[14.5px] text-cream hover:bg-accent disabled:opacity-50"
            >
              {savingReview ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-[13px] text-accent">Saved.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
