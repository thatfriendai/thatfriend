import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DAY_COLORS } from "./itinerary";
import type { PlannerDay, PlannerTrip } from "@/lib/supabase/planner-types";

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/**
 * Backfills planner_days for a trip's date range the first time the trip
 * doc is opened, then always returns the full sorted list. Idempotent via
 * the (trip_id, date) unique constraint. No-ops (returns []) until the trip
 * has both dates set.
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
    return (all ?? []) as PlannerDay[];
  }

  return (existing ?? []) as PlannerDay[];
}
