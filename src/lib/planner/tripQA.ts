import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDayLabel } from "./itinerary";
import { BUDGET_FIELDS } from "./preferences";
import { computeOverlap } from "./convergence";
import type { PlannerDay } from "@/lib/supabase/planner-types";
import { formatPhoneDisplay } from "./phone";

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
    return `no dates locked in yet, so there's no day-by-day plan. mark the days that work for you: ${siteUrl}/planner/trips/${tripId}/dates`;
  }

  const dayIndex = resolveDayIndex(dayRef, days as PlannerDay[]);
  if (dayIndex === null) {
    return `which day did you mean? "day 1" or a weekday like "saturday" works.`;
  }

  const day = days[dayIndex] as PlannerDay;
  const { data: items } = await admin
    .from("planner_itinerary_items")
    .select("text")
    .eq("day_id", day.id)
    .order("position", { ascending: true });

  const label = `day ${dayIndex + 1} (${formatDayLabel(day.date)}${day.city ? `, ${day.city}` : ""})`;
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
    return "nowhere to stay picked yet — once someone throws in an option, i'll have prices to compare.";
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
    if (decided) return `you're staying at ${decided.label} — ${priceOf(decided)}.`;
  }

  if (!options || options.length === 0) {
    return `nowhere to stay settled yet, and no options in the running so far.`;
  }
  const list = options.map((o) => `${o.label} (${priceOf(o)})`).join(", ");
  return `not settled yet — in the running: ${list}.`;
}

/**
 * A broader "is this going to be expensive" question — as opposed to
 * answerLodgingCostQuestion, which only covers the stay decision. Grounded
 * in whatever preferences have actually been submitted (same floor/comfy
 * overlap math as the Convergence view); when nobody's answered anything
 * yet, it's a status reply, not a task — set expectations and get out of
 * the way, rather than listing the internal things someone could add.
 */
async function answerBudgetQuestion(admin: SupabaseClient, tripId: string): Promise<string> {
  const { data: prefRows } = await admin
    .from("planner_preferences")
    .select("stay_max, flight_max, food_max")
    .eq("trip_id", tripId);
  const rows = prefRows ?? [];

  const overlaps = BUDGET_FIELDS.map((field) => {
    const entries = rows
      .filter((r) => typeof r[field.key as keyof (typeof rows)[number]] === "number")
      .map((r) => ({ value: r[field.key as keyof (typeof rows)[number]] as number, userId: null, name: null }));
    return computeOverlap(field.key, field.label, field.max, entries);
  }).filter((o): o is NonNullable<typeof o> => o !== null);

  const { data: stayDecision } = await admin
    .from("planner_decisions")
    .select("id")
    .eq("trip_id", tripId)
    .eq("kind", "stay")
    .limit(1)
    .maybeSingle();

  if (overlaps.length === 0) {
    if (stayDecision) return answerLodgingCostQuestion(admin, tripId);
    return "don't have enough yet to give you a real answer — once people start picking places or answering, i'll have something to go on.";
  }

  const byKey = new Map(overlaps.map((o) => [o.key, o]));
  const pieces: string[] = [];
  const stay = byKey.get("stay_max");
  if (stay) pieces.push(`lodging around $${stay.floor}-${stay.comfy}/night`);
  const food = byKey.get("food_max");
  if (food) pieces.push(`food around $${food.floor}-${food.comfy}/day`);
  const flight = byKey.get("flight_max");
  if (flight) pieces.push(`flights around $${flight.floor}-${flight.comfy} round trip`);

  const base = `from what people have said so far: ${pieces.join(", ")}.`;
  if (stayDecision) return `${base} ${await answerLodgingCostQuestion(admin, tripId)}`;
  return `${base} once there's a place to stay in the running, i can put a real number on it.`;
}

async function answerRosterQuestion(admin: SupabaseClient, tripId: string): Promise<string> {
  const { data: trip } = await admin.from("planner_trips").select("name").eq("id", tripId).maybeSingle();

  const { data: memberRows } = await admin
    .from("planner_memberships")
    .select("user_id, planner_users(name, phone)")
    .eq("trip_id", tripId);
  const members = (memberRows ?? []).map((m) => {
    const person = m.planner_users as unknown as { name: string | null; phone: string | null } | null;
    // Someone who joined by phone and hasn't set a name yet is still a
    // real person on the trip — show the number rather than "someone".
    const label = person?.name?.split(" ")[0] || (person?.phone ? formatPhoneDisplay(person.phone) : "someone");
    return { id: m.user_id as string, label };
  });

  if (members.length <= 1) {
    return `looks like it's just you on ${trip?.name ?? "this trip"} so far. text me their numbers and i'll send the invites.`;
  }

  const { data: prefRows } = await admin.from("planner_preferences").select("user_id").eq("trip_id", tripId);
  const answeredIds = new Set((prefRows ?? []).map((p) => p.user_id as string));
  const notAnswered = members.filter((m) => !answeredIds.has(m.id));

  const who = `${members.length} of you so far: ${members.map((m) => m.label).join(", ")}.`;
  if (answeredIds.size === 0) return `${who} nobody's answered preferences yet.`;
  if (notAnswered.length === 0) return `${who} everyone's answered preferences too.`;
  return `${who} still waiting on ${notAnswered.map((m) => m.label).join(", ")} to answer preferences.`;
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
  topic: "day" | "lodging_cost" | "budget" | "roster" | "other",
  dayRef: string | null
): Promise<string> {
  if (topic === "day") return answerDayQuestion(admin, tripId, dayRef);
  if (topic === "lodging_cost") return answerLodgingCostQuestion(admin, tripId);
  if (topic === "budget") return answerBudgetQuestion(admin, tripId);
  if (topic === "roster") return answerRosterQuestion(admin, tripId);
  return "i can tell you what's planned for a day, what it's looking like cost-wise, where you're staying, or who's in — ask me one of those.";
}
