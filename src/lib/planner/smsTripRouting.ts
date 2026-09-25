import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { todayIn } from "./calendarDate";
import { ACTIVE_TRIP_WINDOW_HOURS } from "@/config/limits";

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
  | { status: "ambiguous"; tripNames: string[]; candidateTripIds: string[] };

/**
 * Every trip this phone's texts could currently be about — an active
 * membership (not left/removed, P1-B) on a trip that hasn't ended.
 */
export async function eligibleTripsForPhone(admin: SupabaseClient, userId: string): Promise<EligibleTrip[]> {
  const today = todayIn("America/New_York");
  const { data } = await admin
    .from("planner_memberships")
    .select("joined_at, planner_trips(id, name, destination, join_code, twilio_conversation_sid, end_date)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: false });

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

function normalize(s: string): string {
  return s
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

async function getActiveTripContext(admin: SupabaseClient, phone: string): Promise<string | null> {
  const { data } = await admin.from("planner_sms_trip_context").select("trip_id, updated_at").eq("phone", phone).maybeSingle();
  if (!data) return null;
  const ageMs = Date.now() - new Date(data.updated_at).getTime();
  if (ageMs > ACTIVE_TRIP_WINDOW_HOURS * 60 * 60 * 1000) return null;
  return data.trip_id;
}

async function setActiveTripContext(admin: SupabaseClient, phone: string, tripId: string): Promise<void> {
  await admin
    .from("planner_sms_trip_context")
    .upsert({ phone, trip_id: tripId, updated_at: new Date().toISOString() }, { onConflict: "phone" });
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
): Promise<void> {
  await admin
    .from("planner_sms_pending_messages")
    .upsert(
      { phone, candidate_trip_ids: candidateTripIds, body, media, created_at: new Date().toISOString() },
      { onConflict: "phone" }
    );
}

async function takePendingMessage(admin: SupabaseClient, phone: string): Promise<PendingMessage | null> {
  const { data } = await admin
    .from("planner_sms_pending_messages")
    .select("candidate_trip_ids, body, media")
    .eq("phone", phone)
    .maybeSingle();
  if (!data) return null;
  await admin.from("planner_sms_pending_messages").delete().eq("phone", phone);
  return { candidateTripIds: data.candidate_trip_ids, body: data.body, media: data.media ?? [] };
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
  media: HeldMedia[] = []
): Promise<RoutingResult> {
  const eligible = await eligibleTripsForPhone(admin, userId);
  if (eligible.length === 0) return { status: "none" };
  if (eligible.length === 1) return { status: "resolved", trip: eligible[0], isMultiTrip: false };

  // Was this phone mid-disambiguation? Try to resolve it from the *current*
  // text before anything else — if it doesn't answer the question either,
  // abandon the hold rather than asking about a message that's now stale.
  const pending = await takePendingMessage(admin, phone);
  if (pending) {
    const pendingCandidates = eligible.filter((t) => pending.candidateTripIds.includes(t.id));
    const resolved = await resolveNamedTrip(body, pendingCandidates);
    if (resolved) {
      await setActiveTripContext(admin, phone, resolved.id);
      return { status: "resolved_from_pending", trip: resolved, isMultiTrip: true, body: pending.body, media: pending.media };
    }
  }

  const switched = matchSwitchCommand(body, eligible);
  if (switched) {
    await setActiveTripContext(admin, phone, switched.id);
    return { status: "switched", trip: switched };
  }

  const named = await resolveNamedTrip(body, eligible);
  if (named) {
    await setActiveTripContext(admin, phone, named.id);
    return { status: "resolved", trip: named, isMultiTrip: true };
  }

  const contextTripId = await getActiveTripContext(admin, phone);
  const contextTrip = contextTripId ? eligible.find((t) => t.id === contextTripId) : undefined;
  if (contextTrip) return { status: "resolved", trip: contextTrip, isMultiTrip: true };

  await holdPendingMessage(admin, phone, eligible.map((t) => t.id), body, media);
  return { status: "ambiguous", tripNames: eligible.map((t) => t.name), candidateTripIds: eligible.map((t) => t.id) };
}
