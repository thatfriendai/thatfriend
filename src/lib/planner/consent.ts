import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsentMethod =
  | "join_code"
  | "link_tap"
  | "contact_match_carryover"
  | "re_opt_in_after_stop"
  | "inbound_reply";

interface ConsentSubject {
  id: string;
  phone: string | null;
  notify_sms: boolean;
  sms_opted_in_at: string | null;
}

/**
 * The single place that flips a phone number's live notify_sms gate on and
 * records why. No-ops (no column update, no log row) when the user is
 * already opted in — this only fires on a state CHANGE, so the log stays a
 * record of consent events rather than a transcript of every inbound text.
 * sms_opted_in_at is set once and never cleared — it's "have they EVER
 * consented," distinct from notify_sms's current-state gate — so a method
 * passed in for someone who already has a timestamp is recorded as a
 * re-opt-in instead, regardless of what the caller guessed.
 */
export async function recordConsentEvent(
  admin: SupabaseClient,
  user: ConsentSubject,
  method: ConsentMethod,
  tripId?: string | null
): Promise<void> {
  if (user.notify_sms || !user.phone) return;

  const now = new Date().toISOString();
  const firstEverConsent = !user.sms_opted_in_at;
  const resolvedMethod: ConsentMethod = firstEverConsent ? method : "re_opt_in_after_stop";

  const updates: Record<string, unknown> = { notify_sms: true };
  if (firstEverConsent) updates.sms_opted_in_at = now;
  await admin.from("planner_users").update(updates).eq("id", user.id);

  await admin.from("planner_sms_consent_log").insert({
    phone: user.phone,
    opted_in_at: firstEverConsent ? now : user.sms_opted_in_at,
    method: resolvedMethod,
    trip_id: tripId ?? null,
  });
}

/**
 * Logs that consent for a NEW trip was carried over from a phone's existing
 * opt-in on a prior trip, without re-asking — no column changes (notify_sms
 * is already true), the point is purely the audit trail. Used by the
 * contact-matching auto-skip path in the invites route.
 */
export async function logConsentCarryover(
  admin: SupabaseClient,
  phone: string,
  optedInAt: string | null,
  tripId: string
): Promise<void> {
  await admin.from("planner_sms_consent_log").insert({
    phone,
    opted_in_at: optedInAt ?? new Date().toISOString(),
    method: "contact_match_carryover",
    trip_id: tripId,
  });
}

const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const START_KEYWORDS = new Set(["start", "yes", "unstop"]);

export type OptKeyword = "stop" | "start" | null;

export function detectOptKeyword(body: string): OptKeyword {
  const normalized = body.trim().toLowerCase();
  if (STOP_KEYWORDS.has(normalized)) return "stop";
  if (START_KEYWORDS.has(normalized)) return "start";
  return null;
}

/**
 * Defensive STOP/START handling for the two inbound-message webhooks.
 * Twilio's Messaging Service Advanced Opt-Out normally intercepts these
 * keywords before they ever reach application code — the opt-out callback
 * route (src/app/api/v2/twilio/opt-out/route.ts) is the reliable mechanism
 * for that case. This only matters if Advanced Opt-Out is off or a keyword
 * slips through some other way; either way it keeps our own state from
 * silently drifting from what the carrier already decided.
 * Returns true if the message was consumed as an opt keyword (caller should
 * stop processing it as ordinary content).
 */
export async function handleOptKeywordFromBody(
  admin: SupabaseClient,
  user: ConsentSubject,
  body: string,
  tripId?: string | null
): Promise<OptKeyword> {
  const keyword = detectOptKeyword(body);
  if (!keyword || !user.phone) return null;
  await applyOptKeyword(admin, user, keyword, tripId);
  return keyword;
}

/**
 * Mirrors a STOP/START the carrier side already acted on into our own
 * notify_sms gate. Called with Twilio's OptOutType (the Messaging Service
 * delivers the keyword text with that parameter set when Advanced Opt-Out
 * handled it — Twilio has already sent its own confirmation and, for STOP,
 * blocks anything we'd try to send) or with a keyword we spotted in a body
 * ourselves.
 */
export async function applyOptKeyword(
  admin: SupabaseClient,
  user: ConsentSubject,
  keyword: Exclude<OptKeyword, null>,
  tripId?: string | null
): Promise<void> {
  if (keyword === "stop") {
    await admin.from("planner_users").update({ notify_sms: false }).eq("id", user.id);
  } else {
    await recordConsentEvent(admin, user, "inbound_reply", tripId);
  }
}
