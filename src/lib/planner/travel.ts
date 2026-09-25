import type { TravelDirection } from "@/lib/supabase/planner-types";

/** "14:20:00" → minutes since midnight. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function hhmm(time: string): string {
  return time.slice(0, 5);
}

export function addMinutes(time: string, delta: number): string {
  // Wraps around midnight rather than clamping to it — a 01:00 departure
  // minus two hours is 23:00 the day before, not 00:00 that same day.
  const t = ((minutesOf(time) + delta) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

// "Nina" / "Nina and Tom" / "Nina, Tom and Priya" — the app's list style.
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const WINDOW = 60;

/**
 * The biggest set of people landing (or leaving) within an hour of each
 * other on the same day — the ones worth putting in one taxi. Null when
 * nobody overlaps.
 */
export function closestCluster<T extends { date: string; time: string }>(legs: T[]): T[] | null {
  let best: T[] = [];
  const byDate = new Map<string, T[]>();
  for (const l of legs) byDate.set(l.date, [...(byDate.get(l.date) ?? []), l]);
  for (const group of byDate.values()) {
    const sorted = [...group].sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
    let start = 0;
    for (let end = 0; end < sorted.length; end++) {
      while (minutesOf(sorted[end].time) - minutesOf(sorted[start].time) > WINDOW) start++;
      if (end - start + 1 > best.length) best = sorted.slice(start, end + 1);
    }
  }
  return best.length >= 2 ? best : null;
}

/** "Maya, Jonah and Nina all land at Lisbon between 14:20 and 15:05." */
export function clusterLine(
  direction: TravelDirection,
  names: string[],
  first: string,
  last: string,
  city: string | null
): string {
  if (names.length === 2) {
    const gap = minutesOf(last) - minutesOf(first);
    const verb = direction === "arrive" ? "land" : "leave";
    return gap === 0
      ? `${joinNames(names)} ${verb} at the same time.`
      : `${joinNames(names)} ${verb} within ${gap} minutes of each other.`;
  }
  const verb = direction === "arrive" ? `all land${city ? ` at ${city}` : ""}` : "all leave";
  return `${joinNames(names)} ${verb} between ${hhmm(first)} and ${hhmm(last)}.`;
}
