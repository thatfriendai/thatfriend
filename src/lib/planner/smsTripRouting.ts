import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { todayIn } from "./calendarDate";
import { ACTIVE_TRIP_WINDOW_HOURS, PENDING_TRIP_ANSWER_MINUTES } from "@/config/limits";
import { toE164 } from "./phone";

/**
 * The zone "has this trip ended yet" is judged in. Trips don't carry their
 * own zone, and this only decides whether a trip that ended *yesterday*
 * still counts — a few hours either way doesn't matter, so one fixed zone.
 */
const TRIP_END_TIME_ZONE = "America/New_York";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface EligibleTrip {
  id: string;
  name: string;
  destination: string | null;
  join_code: string | null;
  twilio_conversation_sid: string | null;
}

export interface HeldMedia {
  url: string;
  contentType: string;
}

export type RoutingResult =
  | { status: "none" }
  | { status: "resolved"; trip: EligibleTrip; isMultiTrip: boolean }
  | { status: "resolved_from_pending"; trip: EligibleTrip; isMultiTrip: boolean; body: string; media: HeldMedia[] }
  | { status: "switched"; trip: EligibleTrip }
  | { status: "ambiguous"; tripNames: string[]; candidateTripIds: string[] }
  // Several trips, none named — but the caller said this message doesn't
  // need one ("thanks", "plan a trip to tokyo"), so nothing was held.
  | { status: "no_trip_needed"; tripNames: string[] };

/**
 * The routing tables arrive in the 2026-09-26 migration. Until it's run,
 * every read/write on them fails with "relation does not exist" (42P01
 * from Postgres, PGRST205 from PostgREST's schema cache) — that used to be
 * swallowed, so nothing was ever remembered and every text got "which
 * trip?". Recognized so routing can fall back to the pre-P1-C behavior.
 */
export function isMissingTableError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/**
 * Every trip this phone's texts could currently be about — an active
 * membership (not left/removed, P1-B) on a trip that hasn't ended.
 */
export async function eligibleTripsForPhone(admin: SupabaseClient, userId: string): Promise<EligibleTrip[]> {
  const today = todayIn(TRIP_END_TIME_ZONE);
  const { data, error } = await admin
    .from("planner_memberships")
    .select("joined_at, planner_trips(id, name, destination, join_code, twilio_conversation_sid, end_date)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: false });
  // An error here used to read as "on no trips" and answer "i don't have a
  // trip for you yet" to someone on three. Throwing lands in the webhook's
  // catch-all instead: "something went wrong", and Twilio can retry.
  if (error) {
    console.error("[smsTripRouting] eligible trips lookup failed", error);
    throw new Error(`eligible trips lookup failed: ${error.message}`);
  }

  type Row = { planner_trips: (EligibleTrip & { end_date: string | null }) | null };
  return ((data ?? []) as unknown as Row[])
    .map((r) => r.planner_trips)
    .filter((t): t is EligibleTrip & { end_date: string | null } => Boolean(t) && (!t!.end_date || t!.end_date >= today))
    .map(({ id, name, destination, join_code, twilio_conversation_sid }) => ({
      id,
      name,
      destination,
      join_code,
      twilio_conversation_sid,
    }));
}

/**
 * Lowercased, accent-folded, punctuation-stripped — so "istanbul" matches
 * "İstanbul" and "krakow" matches "Kraków". NFD splits "ó" into "o" plus a
 * combining mark, which is then dropped; the few letters that don't
 * decompose (Turkish dotted/dotless i, Polish ł, Nordic ø) are mapped by
 * hand first. Without this the [^a-z0-9] pass below deleted them outright.
 */
export function normalize(s: string): string {
  return s
    .replace(/[İıI]/g, "i")
    .replace(/[łŁ]/g, "l")
    .replace(/[øØ]/g, "o")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether `text` clearly names one of `candidates` — by full trip name,
 * destination city, or join code — checked as a whole-word match against
 * normalized (punctuation-stripped, lowercased) text on both sides.
 * Deterministic and exact, so it never misfires the way a looser "contains"
 * check could on a short or common name.
 */
export function matchNamedTrip(text: string, candidates: EligibleTrip[]): EligibleTrip | null {
  const normText = normalize(text);
  if (!normText) return null;
  for (const trip of candidates) {
    const identifiers = [trip.name, trip.destination?.split(",")[0] ?? null, trip.join_code].filter(
      (v): v is string => typeof v === "string" && v.length >= 3
    );
    for (const id of identifiers) {
      const normId = normalize(id);
      if (!normId) continue;
      const pattern = new RegExp(`\\b${normId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (pattern.test(normText)) return trip;
    }
  }
  return null;
}

/**
 * The LLM fallback for when no candidate's name/city/code appears verbatim
 * — "the airbnb we found last week" or a bare continuation of an earlier
 * thread. Scoped to exactly the phone's own candidate trips via the tool
 * schema's enum, so it can never resolve to a trip the sender isn't on.
 */
async function classifyNamedTripByLLM(text: string, candidates: EligibleTrip[]): Promise<EligibleTrip | null> {
  if (candidates.length < 2) return null;
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 100,
      system:
        "The sender is on multiple active group trips. Decide which trip, if any, this message is clearly about, from its content alone — a place, question, or instruction that only makes sense for one of them. If nothing in the message points to a specific trip, say so honestly rather than guessing. Call record_trip.",
      messages: [
        {
          role: "user",
          content: `Trips:\n${candidates.map((c) => `- ${c.id}: "${c.name}"${c.destination ? ` (destination: ${c.destination})` : ""}`).join("\n")}\n\nMessage:\n${text.slice(0, 2000)}`,
        },
      ],
      tools: [
        {
          name: "record_trip",
          description: "Record which trip this message is about, if any is clear.",
          input_schema: {
            type: "object",
            properties: {
              trip_id: { type: "string", enum: [...candidates.map((c) => c.id), "unclear"] },
            },
            required: ["trip_id"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "record_trip" },
    });
    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;
    const id = (toolUse.input as { trip_id?: string }).trip_id;
    return candidates.find((c) => c.id === id) ?? null;
  } catch {
    return null;
  }
}

async function resolveNamedTrip(text: string, candidates: EligibleTrip[]): Promise<EligibleTrip | null> {
  return matchNamedTrip(text, candidates) ?? (await classifyNamedTripByLLM(text, candidates));
}

const SWITCH_PATTERN = /^switch(?:\s+to)?\s+(.+)$/i;

/** "switch to Miami" / "switch Miami" — an explicit control command, not content to process. */
export function matchSwitchCommand(text: string, candidates: EligibleTrip[]): EligibleTrip | null {
  const match = text.trim().match(SWITCH_PATTERN);
  if (!match) return null;
  return matchNamedTrip(match[1], candidates);
}

// Words someone might wrap a bare "which trip?" answer in — "the lisbon
// one", "oh it's for austin", "sorry, first one". Anything left over after
// these and the trip's own name/city/code means the text says something
// more than just the answer.
const ANSWER_FILLER = new Set([
  "the", "a", "an", "for", "it", "its", "s", "is", "was", "that", "this", "one", "trip", "to", "about",
  "in", "on", "oh", "um", "uh", "ok", "okay", "yes", "yeah", "yep", "sorry", "i", "meant", "mean",
  "please", "pls", "plz", "first", "second", "last", "other", "lol", "haha",
  // "Lisbon, thanks!" is still just the answer — without these the held
  // link was dropped and the reply was treated as a thank-you.
  "thanks", "thank", "you", "thx", "ty", "cheers", "k", "kk", "sure",
]);

/**
 * Whether `text` is essentially just an answer to "which trip?" naming
 * `trip` — nothing but its name, city, join code (or words of its name)
 * and filler. Only then is the held message replayed in its place; a text
 * with anything more in it ("lisbon — what time is checkin?") is a new
 * message in its own right and is what gets processed.
 */
export function isBareTripAnswer(text: string, trip: EligibleTrip): boolean {
  let rest = ` ${normalize(text)} `;
  if (!rest.trim()) return false;
  // Every comma part of the destination counts ("portugal" for
  // "Lisbon, Portugal"), not just the city.
  const identifiers = [trip.name, trip.destination, ...(trip.destination?.split(",") ?? []), trip.join_code]
    .filter((v): v is string => typeof v === "string")
    .map(normalize)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const id of identifiers) rest = rest.split(` ${id} `).join(" ");
  const nameWords = new Set(normalize(trip.name).split(" ").filter((w) => w.length >= 3));
  return rest
    .split(" ")
    .filter(Boolean)
    .every((w) => ANSWER_FILLER.has(w) || nameWords.has(w));
}

/** Whether a hold created at `createdAt` is still waiting for its answer (see PENDING_TRIP_ANSWER_MINUTES). */
export function isHoldFresh(createdAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return now - created <= PENDING_TRIP_ANSWER_MINUTES * 60 * 1000;
}

type TableRead<T> = { value: T; tablesMissing: boolean };

async function getActiveTripContext(admin: SupabaseClient, phone: string): Promise<TableRead<string | null>> {
  const { data, error } = await admin
    .from("planner_sms_trip_context")
    .select("trip_id, updated_at")
    .eq("phone", phone)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return { value: null, tablesMissing: true };
    console.error("[smsTripRouting] trip context read failed", error);
    return { value: null, tablesMissing: false };
  }
  if (!data) return { value: null, tablesMissing: false };
  const ageMs = Date.now() - new Date(data.updated_at).getTime();
  if (ageMs > ACTIVE_TRIP_WINDOW_HOURS * 60 * 60 * 1000) return { value: null, tablesMissing: false };
  return { value: data.trip_id, tablesMissing: false };
}

async function setTripContextForPhone(admin: SupabaseClient, phone: string, tripId: string): Promise<void> {
  const { error } = await admin
    .from("planner_sms_trip_context")
    .upsert({ phone, trip_id: tripId, updated_at: new Date().toISOString() }, { onConflict: "phone" });
  // Missing table = migration not run yet; routing falls back without it.
  if (error && !isMissingTableError(error)) console.error("[smsTripRouting] trip context write failed", error);
}

/**
 * Makes `tripId` the trip this user's next unlabeled 1:1 text routes to —
 * e.g. right after they join one, so "is the airbnb booked?" goes to the
 * trip they just joined rather than prompting "which trip?". Best-effort:
 * a user with no phone, or a database without the routing tables yet, is
 * a no-op.
 */
export async function setActiveTripContext(admin: SupabaseClient, userId: string, tripId: string): Promise<void> {
  try {
    const { data } = await admin.from("planner_users").select("phone").eq("id", userId).maybeSingle();
    if (!data?.phone) return;
    await setTripContextForPhone(admin, toE164(data.phone), tripId);
  } catch (e) {
    console.error("[smsTripRouting] setActiveTripContext failed", e);
  }
}

interface PendingMessage {
  candidateTripIds: string[];
  body: string;
  media: HeldMedia[];
}

/** Overwrites (not queues) any previous hold for this phone — only the most recent ambiguous text is worth asking about. */
export async function holdPendingMessage(
  admin: SupabaseClient,
  phone: string,
  candidateTripIds: string[],
  body: string,
  media: HeldMedia[] = []
): Promise<{ tablesMissing: boolean }> {
  const { error } = await admin
    .from("planner_sms_pending_messages")
    .upsert(
      { phone, candidate_trip_ids: candidateTripIds, body, media, created_at: new Date().toISOString() },
      { onConflict: "phone" }
    );
  if (error && isMissingTableError(error)) return { tablesMissing: true };
  if (error) console.error("[smsTripRouting] hold pending message failed", error);
  return { tablesMissing: false };
}

/**
 * Reads and clears this phone's hold. A hold older than
 * PENDING_TRIP_ANSWER_MINUTES is cleared but not returned — it used to
 * live forever, so a trip named days later replayed a long-forgotten text.
 */
async function takePendingMessage(admin: SupabaseClient, phone: string): Promise<TableRead<PendingMessage | null>> {
  const { data, error } = await admin
    .from("planner_sms_pending_messages")
    .select("candidate_trip_ids, body, media, created_at")
    .eq("phone", phone)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return { value: null, tablesMissing: true };
    console.error("[smsTripRouting] pending message read failed", error);
    return { value: null, tablesMissing: false };
  }
  if (!data) return { value: null, tablesMissing: false };
  await admin.from("planner_sms_pending_messages").delete().eq("phone", phone);
  if (!isHoldFresh(data.created_at)) return { value: null, tablesMissing: false };
  return {
    value: { candidateTripIds: data.candidate_trip_ids, body: data.body, media: data.media ?? [] },
    tablesMissing: false,
  };
}

/**
 * The one entry point route.ts calls in place of its old single-membership
 * lookup. Handles every case from the P1-C spec: zero/one/many eligible
 * trips, a message that names one, an unanswered disambiguation being
 * resolved by the current reply, an explicit "switch to X", the
 * active-trip context window, and genuine ambiguity (asked about, and
 * held rather than dropped).
 */
export async function routeInboundMessage(
  admin: SupabaseClient,
  userId: string,
  phone: string,
  body: string,
  media: HeldMedia[] = [],
  options: {
    /**
     * Asked only when the sender is on several trips and nothing picked
     * one — false means this message doesn't need a trip at all ("thanks",
     * "plan a trip to tokyo"), so there's nothing to ask "which trip?"
     * about. Asking anyway is what made "thanks" loop.
     */
    needsTrip?: () => Promise<boolean>;
  } = {}
): Promise<RoutingResult> {
  const eligible = await eligibleTripsForPhone(admin, userId);
  if (eligible.length === 0) return { status: "none" };
  if (eligible.length === 1) return { status: "resolved", trip: eligible[0], isMultiTrip: false };

  // Was this phone mid-disambiguation? Try to resolve it from the *current*
  // text before anything else — if it doesn't answer the question either,
  // abandon the hold rather than asking about a message that's now stale.
  const { value: pending, tablesMissing } = await takePendingMessage(admin, phone);
  if (pending) {
    const pendingCandidates = eligible.filter((t) => pending.candidateTripIds.includes(t.id));
    const resolved = await resolveNamedTrip(body, pendingCandidates);
    if (resolved) {
      await setTripContextForPhone(admin, phone, resolved.id);
      // Only a bare answer ("lisbon", "the austin one") stands in for the
      // held text. Anything more is its own message — processing the old
      // body there silently dropped what they'd just written.
      if (isBareTripAnswer(body, resolved)) {
        return { status: "resolved_from_pending", trip: resolved, isMultiTrip: true, body: pending.body, media: pending.media };
      }
      return { status: "resolved", trip: resolved, isMultiTrip: true };
    }
  }

  const switched = matchSwitchCommand(body, eligible);
  if (switched) {
    await setTripContextForPhone(admin, phone, switched.id);
    return { status: "switched", trip: switched };
  }

  const named = await resolveNamedTrip(body, eligible);
  if (named) {
    await setTripContextForPhone(admin, phone, named.id);
    return { status: "resolved", trip: named, isMultiTrip: true };
  }

  // Before the 09-26 migration there's nowhere to remember a pick or hold
  // a message, so asking "which trip?" could never be answered — every text
  // would ask again. Go back to the pre-P1-C behavior (most recently joined
  // trip); isMultiTrip keeps the "<Trip>: " prefix so the guess is visible.
  const fallback = { status: "resolved", trip: eligible[0], isMultiTrip: true } as const;
  if (tablesMissing) return fallback;

  const context = await getActiveTripContext(admin, phone);
  if (context.tablesMissing) return fallback;
  const contextTrip = context.value ? eligible.find((t) => t.id === context.value) : undefined;
  if (contextTrip) return { status: "resolved", trip: contextTrip, isMultiTrip: true };

  const tripNames = eligible.map((t) => t.name);
  if (options.needsTrip && !(await options.needsTrip())) return { status: "no_trip_needed", tripNames };

  const held = await holdPendingMessage(admin, phone, eligible.map((t) => t.id), body, media);
  if (held.tablesMissing) return fallback;
  return { status: "ambiguous", tripNames, candidateTripIds: eligible.map((t) => t.id) };
}
