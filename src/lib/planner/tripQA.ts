import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDayLabel } from "./itinerary";
import type { PlannerDay } from "@/lib/supabase/planner-types";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function weekdayOf(date: string): string {
  return WEEKDAYS[new Date(date + "T00:00:00").getDay()];
}

/** Resolves whatever the sender used to refer to a day ("day 1", "Saturday", "tomorrow") against the trip's real days. Returns null if it can't tell which one they meant. */
function resolveDayIndex(dayRef: string | null, days: PlannerDay[]): number | null {
  if (!dayRef || days.length === 0) return null;

  const ordinal = dayRef.match(/day\s*(\d+)/i);
  if (ordinal) {
    const idx = parseInt(ordinal[1], 10) - 1;
    return idx >= 0 && idx < days.length ? idx : null;
  }

  const weekday = dayRef.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i);
  if (weekday) {
    const idx = days.findIndex((d) => weekdayOf(d.date) === weekday[0].toLowerCase());
    return idx >= 0 ? idx : null;
  }

  const today = new Date();
  if (/tomorrow/i.test(dayRef)) {
    today.setDate(today.getDate() + 1);
    const iso = today.toISOString().slice(0, 10);
    const idx = days.findIndex((d) => d.date === iso);
    return idx >= 0 ? idx : null;
  }
  if (/\btoday\b/i.test(dayRef)) {
    const iso = today.toISOString().slice(0, 10);
    const idx = days.findIndex((d) => d.date === iso);
    return idx >= 0 ? idx : null;
  }

  return null;
}

async function answerDayQuestion(
  admin: SupabaseClient,
  tripId: string,
  dayRef: string | null
): Promise<string> {
  const { data: days } = await admin
    .from("planner_days")
    .select("*")
    .eq("trip_id", tripId)
    .order("date", { ascending: true });

  if (!days || days.length === 0) {
    return "This trip doesn't have dates locked in yet, so there's no day-by-day plan to check.";
  }

  const dayIndex = resolveDayIndex(dayRef, days as PlannerDay[]);
  if (dayIndex === null) {
    return "Which day did you mean? Try \"day 1\" or a weekday like \"Saturday.\"";
  }

  const day = days[dayIndex] as PlannerDay;
  const { data: items } = await admin
    .from("planner_itinerary_items")
    .select("text")
    .eq("day_id", day.id)
    .order("position", { ascending: true });

  const label = `Day ${dayIndex + 1} (${formatDayLabel(day.date)}${day.city ? `, ${day.city}` : ""})`;
  if (!items || items.length === 0) {
    return `${label}: nothing planned yet.`;
  }
  return `${label}: ${items.map((i) => i.text).join(", ")}.`;
}

async function answerLodgingCostQuestion(admin: SupabaseClient, tripId: string): Promise<string> {
  const { data: decision } = await admin
    .from("planner_decisions")
    .select("id, title, status, decided_option_id")
    .eq("trip_id", tripId)
    .eq("kind", "lodging")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!decision) {
    return "No lodging decision started for this trip yet.";
  }

  const { data: options } = await admin
    .from("planner_decision_options")
    .select("id, label, cost, total_price, price_per_person_night")
    .eq("decision_id", decision.id);

  const priceOf = (o: { total_price: number | null; price_per_person_night: number | null; cost: string | null }) => {
    if (o.total_price != null) return `$${o.total_price} total`;
    if (o.price_per_person_night != null) return `$${o.price_per_person_night}/person/night`;
    return o.cost ?? "no price given";
  };

  if (decision.status === "closed" && decision.decided_option_id) {
    const decided = (options ?? []).find((o) => o.id === decision.decided_option_id);
    if (decided) return `"${decided.label}" is decided for "${decision.title}" — ${priceOf(decided)}.`;
  }

  if (!options || options.length === 0) {
    return `"${decision.title}" hasn't been decided yet, and no options have been added.`;
  }
  const list = options.map((o) => `${o.label} (${priceOf(o)})`).join(", ");
  return `"${decision.title}" hasn't been decided yet — options so far: ${list}.`;
}

/**
 * Answers one of the two questions this can currently handle, always
 * grounded directly in real trip rows — never an LLM guessing at an
 * answer. "other" gets a plain, honest scope statement rather than an
 * attempt at a general answer, which would need much broader data
 * assembly (see the plan this shipped from).
 */
export async function answerTripQuestion(
  admin: SupabaseClient,
  tripId: string,
  topic: "day" | "lodging_cost" | "other",
  dayRef: string | null
): Promise<string> {
  if (topic === "day") return answerDayQuestion(admin, tripId, dayRef);
  if (topic === "lodging_cost") return answerLodgingCostQuestion(admin, tripId);
  return "I can tell you about the day-by-day plan or lodging cost right now — ask me one of those.";
}
