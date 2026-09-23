"use client";

import { useSyncExternalStore, useState } from "react";
import { DAY_COLORS } from "@/lib/planner/itinerary";

/**
 * "Last time · Mallorca, May" — what this same group said, after its last
 * trip together, it would do differently. Hiding it is per-viewer and
 * remembered in this browser only.
 */
export function LastTimeCard({
  sourceTripId,
  label,
  lessons,
}: {
  sourceTripId: string;
  label: string;
  lessons: { id: string; userId: string; who: string; body: string }[];
}) {
  const storageKey = `tf:hide-last-time:${sourceTripId}`;
  const storedHidden = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(storageKey) === "1";
      } catch {
        return false;
      }
    },
    () => false
  );
  const [hiddenNow, setHiddenNow] = useState(false);
  if (storedHidden || hiddenNow) return null;

  const colorOf = new Map<string, string>();
  for (const l of lessons) if (!colorOf.has(l.userId)) colorOf.set(l.userId, DAY_COLORS[colorOf.size % DAY_COLORS.length]);

  function hide() {
    setHiddenNow(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // Hidden for this visit only.
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-warm-border bg-warm-bg px-5 py-4">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6B655C] uppercase">Last time &middot; {label}</span>
        <span className="text-[13px] text-ink-soft">What this group said it would do differently</span>
        <button type="button" onClick={hide} className="ml-auto px-1 text-[13px] text-ink-soft hover:text-ink">
          Hide
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {lessons.map((l) => (
          <div key={l.id} className="flex items-center gap-2.5">
            <span
              className="flex h-5.5 w-5.5 flex-none items-center justify-center rounded-full font-mono text-[9px] text-on-accent"
              style={{ background: colorOf.get(l.userId) }}
              title={l.who}
            >
              {l.who.slice(0, 2).toUpperCase()}
            </span>
            <span className="text-[14.5px] leading-[1.45] text-ink-body">{l.body}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
