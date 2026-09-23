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
 * consented," distinct from notify_sms's current-state gate.
 *
 * Someone with a timestamp but notify_sms off texted STOP at some point,
 * and only an explicit START/UNSTOP undoes that (applyOptKeyword, which
 * passes "re_opt_in_after_stop") — any other text, a "1" to an invite, or
 * a link tap is a no-op for them. Treating every inbound text as a re-opt-in
 * meant "ok thanks" right after STOP quietly turned texts back on, and
 * Twilio's Advanced Opt-Out would still be blocking them carrier-side, so
 * our gate would disagree with what actually gets delivered.
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
  if (!firstEverConsent && method !== "re_opt_in_after_stop") return;
  // A START from someone who never opted in before is their first consent,
  // not a re-opt-in — log it as the plain reply it is.
  const resolvedMethod: ConsentMethod = firstEverConsent
    ? method === "re_opt_in_after_stop" ? "inbound_reply" : method
    : "re_opt_in_after_stop";

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

// Twilio's standard opt-out keywords. CANCEL/END/QUIT are real carrier
// keywords in a 1:1 thread, but in a group thread they're ordinary words
// ("end" as in "the end of the trip", "cancel" the dinner) — there only the
// unambiguous ones count.
const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const GROUP_STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe"]);
// No "yes": Twilio treats it as an opt-in keyword too, but it's also the
// most common reply to any question anyone asks — as an opt keyword it
// posted "you're back in" into the middle of conversations.
const START_KEYWORDS = new Set(["start", "unstop"]);

export type OptKeyword = "stop" | "start" | null;

export function detectOptKeyword(body: string, opts: { groupThread?: boolean } = {}): OptKeyword {
  const normalized = body.trim().toLowerCase();
  if ((opts.groupThread ? GROUP_STOP_KEYWORDS : STOP_KEYWORDS).has(normalized)) return "stop";
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
 * Returns the keyword if the message was consumed as one (caller should
 * stop processing it as ordinary content). A START from someone who's
 * already opted in isn't consumed — there's nothing to turn back on, and
 * "you're back in" would just be confusing.
 */
export async function handleOptKeywordFromBody(
  admin: SupabaseClient,
  user: ConsentSubject,
  body: string,
  tripId?: string | null,
  opts: { groupThread?: boolean } = {}
): Promise<OptKeyword> {
  const keyword = detectOptKeyword(body, opts);
  if (!keyword || !user.phone) return null;
  if (keyword === "start" && user.notify_sms) return null;
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
    await recordConsentEvent(admin, user, "re_opt_in_after_stop", tripId);
  }
}
