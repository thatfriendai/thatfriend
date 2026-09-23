import "server-only";
import { dateRange } from "./calendarDate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DAY_COLORS } from "./itinerary";
import type { PlannerDay, PlannerTrip } from "@/lib/supabase/planner-types";

/**
 * Backfills planner_days for a trip's date range the first time the trip
 * doc is opened, then returns the sorted days inside the trip's current
 * start..end. Idempotent via the (trip_id, date) unique constraint. No-ops
 * (returns []) until the trip has both dates set.
 *
 * Re-locking dates never deletes planner_days (their items would go with
 * them), so rows from the old range are still in the table. Empty ones are
 * dropped from the result; ones that still hold plans stay, just off the
 * active range — the lock route promises exactly that, and hiding them
 * would strand their items and scheduled places where nothing can reach.
 */
export async function ensureDays(
  admin: SupabaseClient,
  trip: Pick<PlannerTrip, "id" | "start_date" | "end_date" | "destination">
): Promise<PlannerDay[]> {
  if (!trip.start_date || !trip.end_date) return [];

  const { data: existing } = await admin
    .from("planner_days")
    .select("*")
    .eq("trip_id", trip.id)
    .order("date", { ascending: true });

  const existingDates = new Set((existing ?? []).map((d) => d.date));
  const dates = dateRange(trip.start_date, trip.end_date);
  const missing = dates.filter((d) => !existingDates.has(d));

  if (missing.length > 0) {
    const rows = missing.map((date) => ({
      trip_id: trip.id,
      date,
      city: trip.destination ?? null,
      color: DAY_COLORS[dates.indexOf(date) % DAY_COLORS.length],
    }));
    await admin.from("planner_days").insert(rows);

    const { data: all } = await admin
      .from("planner_days")
      .select("*")
      .eq("trip_id", trip.id)
      .order("date", { ascending: true });
    return withoutEmptyStaleDays(admin, (all ?? []) as PlannerDay[], trip.start_date, trip.end_date);
  }

  return withoutEmptyStaleDays(admin, (existing ?? []) as PlannerDay[], trip.start_date, trip.end_date);
}

/** The trip's active range, plus any day outside it that still has itinerary items or scheduled places. */
export async function withoutEmptyStaleDays<T extends { id: string; date: string }>(
  admin: SupabaseClient,
  days: T[],
  start: string,
  end: string
): Promise<T[]> {
  const stale = days.filter((d) => d.date < start || d.date > end).map((d) => d.id);
  if (stale.length === 0) return days;

  const [{ data: items }, { data: places }] = await Promise.all([
    admin.from("planner_itinerary_items").select("day_id").in("day_id", stale),
    admin.from("planner_places").select("day_id").in("day_id", stale),
  ]);
  const hasPlans = new Set([...(items ?? []), ...(places ?? [])].map((r) => r.day_id as string));
  return days.filter((d) => (d.date >= start && d.date <= end) || hasPlans.has(d.id));
}

/** The days on or between `start` and `end` — the trip's active range. */
export function inTripRange<T extends { date: string }>(days: T[], start: string, end: string): T[] {
  return days.filter((d) => d.date >= start && d.date <= end);
}
