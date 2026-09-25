/**
 * Helpers for date-only "YYYY-MM-DD" strings (trip dates, availability
 * marks, itinerary days). They're calendar dates, not instants, so all the
 * arithmetic here happens in UTC: `new Date("2026-10-09T00:00:00")` is local
 * midnight, and its `toISOString()` lands on the previous day anywhere east
 * of UTC (Europe, Türkiye, Asia) — that's how a trip's days came out shifted
 * by one. Safe on both server and client.
 */
import { MAX_TRIP_DAYS, MAX_AVAILABILITY_MARKS } from "@/config/limits";

const DAY_MS = 86_400_000;

function toUtcMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** `date` shifted by `days` calendar days. */
export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Every date from `start` to `end`, inclusive. Empty when `end` is before `start`. */
export function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const last = toUtcMs(end);
  for (let ms = toUtcMs(start); ms <= last; ms += DAY_MS) dates.push(fromUtcMs(ms));
  return dates;
}

/** Whole calendar days from `start` to `end` (negative if `end` is earlier) — never fractional across DST. */
export function daysBetween(start: string, end: string): number {
  return Math.round((toUtcMs(end) - toUtcMs(start)) / DAY_MS);
}

/**
 * Today's calendar date where the person (or trip) actually is — not
 * `new Date().toISOString().slice(0, 10)`, which is already tomorrow for
 * anyone in the Americas after ~5pm. With no zone it uses the runtime's
 * own (the browser's, in a client component). Falls back to UTC on an
 * unknown zone rather than throwing.
 */
export function todayIn(timeZone?: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * A real "YYYY-MM-DD" calendar date — not just the right shape. The regex
 * alone lets "2026-02-30" through, which Postgres then rejects mid-write
 * (or `Date.UTC` silently rolls over to March 2), so every API route that
 * takes a date from a request body checks this instead.
 */
export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtcMs(toUtcMs(value)) === value;
}

/**
 * Why a start/end pair can't be a trip's dates, as a message fit to show
 * the person — or null when it's fine. Shared by trip creation and date
 * locking so the two can't disagree about what a valid range is.
 */
export function tripRangeError(start: unknown, end: unknown): string | null {
  if (!isValidCalendarDate(start) || !isValidCalendarDate(end)) return "Those dates don't look right — pick a start and end date.";
  if (start > end) return "The trip has to end on or after the day it starts.";
  if (daysBetween(start, end) + 1 > MAX_TRIP_DAYS) return `Trips can be at most ${MAX_TRIP_DAYS} days long.`;
  return null;
}

/**
 * The availability dates a request may save: real calendar dates,
 * deduped, within about a year back (a stale tab re-saving old marks
 * shouldn't fail) to two years out. Null when there are more than
 * MAX_AVAILABILITY_MARKS — a bad client, not a person's availability.
 */
export function sanitizeMarkDates(input: unknown, today: string): string[] | null {
  if (!Array.isArray(input)) return [];
  const earliest = addDays(today, -366);
  const latest = addDays(today, 2 * 366);
  const dates = [...new Set(input.filter(isValidCalendarDate))].filter((d) => d >= earliest && d <= latest);
  return dates.length > MAX_AVAILABILITY_MARKS ? null : dates;
}

/**
 * "Sep 28–Oct 3" for a trip header — the end's month is only dropped when
 * it's the start's ("Sep 3–8"). Leaving it off unconditionally made a
 * cross-month trip read "Sep 28–3". Formatted in UTC to match how the
 * dates are parsed here, so no runtime zone can shift a day.
 */
export function formatDateRange(
  start: string,
  end: string,
  { month = "short", separator = "–" }: { month?: "short" | "long"; separator?: string } = {}
): string {
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const fmt = (date: string, withMonth: boolean) =>
    new Date(toUtcMs(date)).toLocaleDateString(undefined, {
      timeZone: "UTC",
      day: "numeric",
      ...(withMonth ? { month } : {}),
    });
  return `${fmt(start, true)}${separator}${fmt(end, !sameMonth)}`;
}
