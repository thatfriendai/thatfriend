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
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    return `No dates locked in yet, so there's no day-by-day plan. Mark the days that work for you: ${siteUrl}/planner/trips/${tripId}/dates`;
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
    .eq("kind", "stay")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!decision) {
    return "No lodging decision started for this trip yet.";
  }

  const { data: options } = await admin
    .from("planner_decision_options")
    .select("id, label, cost, total_cost, currency")
    .eq("decision_id", decision.id);

  const priceOf = (o: { total_cost: number | null; currency: string | null; cost: string | null }) => {
    if (o.total_cost != null) {
      const symbol = o.currency === "EUR" ? "€" : o.currency === "GBP" ? "£" : o.currency && o.currency !== "USD" ? `${o.currency} ` : "$";
      return `${symbol}${o.total_cost} total`;
    }
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

async function answerRosterQuestion(admin: SupabaseClient, tripId: string): Promise<string> {
  const { data: trip } = await admin
    .from("planner_trips")
    .select("join_code")
    .eq("id", tripId)
    .maybeSingle();

  const { data: memberRows } = await admin
    .from("planner_memberships")
    .select("user_id, planner_users(name)")
    .eq("trip_id", tripId);
  const members = (memberRows ?? []).map((m) => ({
    id: m.user_id as string,
    name: (m.planner_users as unknown as { name: string | null } | null)?.name ?? null,
  }));

  if (members.length <= 1) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const howToInvite = trip?.join_code
      ? `Have them text "HELLO ${trip.join_code}" to this number to join.`
      : `Invite them from the app: ${siteUrl}/planner/trips/${tripId}`;
    return `Looks like it's just you on this trip so far. ${howToInvite}`;
  }

  const { data: prefRows } = await admin.from("planner_preferences").select("user_id").eq("trip_id", tripId);
  const answeredIds = new Set((prefRows ?? []).map((p) => p.user_id as string));
  const notAnswered = members.filter((m) => !answeredIds.has(m.id));

  if (notAnswered.length === 0) {
    return `Yep — all ${members.length} of you have answered preferences.`;
  }
  const names = notAnswered.map((m) => m.name?.split(" ")[0] || "someone").join(", ");
  return `${members.length - notAnswered.length} of ${members.length} have answered preferences — still waiting on ${names}.`;
}

/**
 * Answers one of the questions this can currently handle, always grounded
 * directly in real trip rows — never an LLM guessing at an answer. "other"
 * gets a plain, honest scope statement rather than an attempt at a general
 * answer, which would need much broader data assembly (see the plan this
 * shipped from).
 */
export async function answerTripQuestion(
  admin: SupabaseClient,
  tripId: string,
  topic: "day" | "lodging_cost" | "roster" | "other",
  dayRef: string | null
): Promise<string> {
  if (topic === "day") return answerDayQuestion(admin, tripId, dayRef);
  if (topic === "lodging_cost") return answerLodgingCostQuestion(admin, tripId);
  if (topic === "roster") return answerRosterQuestion(admin, tripId);
  return "I can tell you about the day-by-day plan, lodging cost, or who's confirmed — ask me one of those.";
}
