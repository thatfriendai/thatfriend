"use client";

import { useMemo, useState } from "react";

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
  const [anchor, setAnchor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const marked = useMemo(() => new Set(value), [value]);

  function toggle(iso: string) {
    if (marked.has(iso)) onChange(value.filter((d) => d !== iso));
    else onChange([...value, iso]);
  }

  function shift(delta: number) {
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
          aria-label="Previous month"
          className="rounded-full border border-input-border px-2.5 py-1 text-sm text-muted hover:border-ink hover:text-ink"
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
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggle(iso)}
                    className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md text-[12.5px] transition-colors ${
                      on
                        ? "bg-accent text-cream"
                        : "text-ink-soft hover:bg-border-soft"
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
