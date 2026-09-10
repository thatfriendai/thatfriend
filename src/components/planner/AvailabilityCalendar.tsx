"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function monthLabel(y: number, m: number) {
  return new Date(y, m, 1).toLocaleDateString(undefined, { month: "long" });
}

function buildMonth(y: number, m: number) {
  const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

/**
 * Controlled multi-day picker: "mark every day that could work." Pure —
 * callers own persistence (local state for New Trip, an API call for
 * Preferences/Dates).
 */
export function AvailabilityCalendar({
  value,
  onChange,
  monthsToShow = 2,
}: {
  value: string[];
  onChange: (dates: string[]) => void;
  monthsToShow?: number;
}) {
  const today = new Date();
  const todayIso = toISO(today.getFullYear(), today.getMonth(), today.getDate());
  const [anchor, setAnchor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const marked = useMemo(() => new Set(value), [value]);
  // Mutated synchronously for the life of one drag gesture, independent of
  // React's render/batching timing — reading `value` (a prop) mid-drag would
  // race rapid-fire mouseenter events against React's async state updates
  // and silently drop cells when several land in the same batch.
  const dragSetRef = useRef<Set<string> | null>(null);
  const dragModeRef = useRef<"add" | "remove" | null>(null);

  useEffect(() => {
    function endDrag() {
      dragModeRef.current = null;
      dragSetRef.current = null;
    }
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  function applyDrag(iso: string) {
    const mode = dragModeRef.current;
    const set = dragSetRef.current;
    if (!mode || !set || iso < todayIso) return;
    const has = set.has(iso);
    if (mode === "add" && !has) {
      set.add(iso);
      onChange(Array.from(set));
    }
    if (mode === "remove" && has) {
      set.delete(iso);
      onChange(Array.from(set));
    }
  }

  function startDrag(iso: string) {
    if (iso < todayIso) return;
    const set = new Set(value);
    dragModeRef.current = set.has(iso) ? "remove" : "add";
    dragSetRef.current = set;
    applyDrag(iso);
  }

  // One handler for mouse, touch, and pen alike. Pointer capture keeps every
  // move event routed to the cell the gesture *started* on, no matter which
  // element the cursor/finger is actually over — so resolving the day under
  // the pointer via elementFromPoint (rather than depending on each cell's
  // own hover/enter event firing as the pointer sweeps across, which is
  // unreliable for a fast drag) is what makes the multi-day drag reliable.
  function handlePointerDown(e: React.PointerEvent, iso: string) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startDrag(iso);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragModeRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const iso = el?.getAttribute("data-iso");
    if (iso) applyDrag(iso);
  }

  const atEarliestMonth = anchor.y === today.getFullYear() && anchor.m === today.getMonth();

  function shift(delta: number) {
    if (delta < 0 && atEarliestMonth) return;
    setAnchor((a) => {
      const total = a.m + delta;
      const y = a.y + Math.floor(total / 12);
      const m = ((total % 12) + 12) % 12;
      return { y, m };
    });
  }

  const months = Array.from({ length: monthsToShow }, (_, i) => {
    const total = anchor.m + i;
    return { y: anchor.y + Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={atEarliestMonth}
          aria-label="Previous month"
          className="rounded-full border border-input-border px-2.5 py-1 text-sm text-muted hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-input-border disabled:hover:text-muted"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className="rounded-full border border-input-border px-2.5 py-1 text-sm text-muted hover:border-ink hover:text-ink"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {months.map(({ y, m }) => (
          <div key={`${y}-${m}`}>
            <p className="mb-2.5 text-sm font-medium text-ink">{monthLabel(y, m)}</p>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="font-mono text-[10px] text-faint">
                  {w}
                </span>
              ))}
              {buildMonth(y, m).map((d, i) => {
                if (d === null) return <span key={i} />;
                const iso = toISO(y, m, d);
                const on = marked.has(iso);
                const past = iso < todayIso;
                return (
                  <button
                    key={i}
                    type="button"
                    data-iso={iso}
                    disabled={past}
                    onPointerDown={(e) => handlePointerDown(e, iso)}
                    onPointerMove={handlePointerMove}
                    className={`mx-auto flex h-7 w-7 touch-none items-center justify-center rounded-md text-[12.5px] transition-colors select-none ${
                      past
                        ? "cursor-not-allowed text-faint opacity-40"
                        : on
                          ? "bg-accent text-cream"
                          : "text-ink-body hover:bg-border-soft"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
