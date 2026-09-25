import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendUserText } from "@/lib/twilio/send";
import { getOrCreateTripConversation, sendConversationMessage } from "@/lib/twilio/conversations";
import { activeMembersOf } from "./membership";
import { cooldownRemainingMs } from "./nudgeCooldown";
import { NUDGE_COOLDOWN_HOURS } from "@/config/limits";

export type NudgeStage = "availability" | "preferences";
export type NudgeMode = "group" | "individual";

/**
 * Nudges trip members who haven't answered a stage yet — shared by the web
 * "Nudge" button (src/app/api/v2/trips/[id]/nudge/route.ts), the daily
 * cron, and both "nudge" SMS intents, so there's one place that knows
 * who's pending AND one place enforcing the cooldown (P2-7) — a route-only
 * check would leave the two SMS paths free to spam.
 *
 * `nudgedBy` is the planner_users id of whoever asked for this, or null
 * for the automated cron nudge (nobody clicked it).
 */
export async function sendNudge(
  admin: SupabaseClient,
  trip: { id: string; name: string; twilio_conversation_sid: string | null },
  stage: NudgeStage,
  mode: NudgeMode,
  nudgedBy: string | null = null
): Promise<{ sentCount: number } | { error: string }> {
  const { data: lastNudge, error: lastNudgeError } = await admin
    .from("planner_nudge_log")
    .select("sent_at")
    .eq("trip_id", trip.id)
    .eq("stage", stage)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Logged, not fatal — a transient read failure shouldn't take the whole
  // feature down, but it also shouldn't silently pretend the cooldown
  // check never happened (the class of bug just found in activeMembersOf).
  if (lastNudgeError) console.error("nudge cooldown check failed", lastNudgeError);
  const remainingMs = cooldownRemainingMs(lastNudge?.sent_at ?? null, NUDGE_COOLDOWN_HOURS);
  if (remainingMs > 0) {
    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
    const what = stage === "availability" ? "dates" : "preferences";
    return { error: `Already nudged about ${what} recently — try again in about ${remainingHours}h.` };
  }

  // activeMembersOf excludes anyone who's left/been removed (P1-B) — never
  // nudge someone who isn't really on this trip anymore.
  const members = await activeMembersOf(admin, trip.id);
  const nudgeable = members
    .map((m) => ({ id: m.user_id, name: m.name, phone: m.phone, whatsapp_opt_in: m.whatsapp_opt_in, notify_sms: m.notify_sms }))
    .filter((m): m is typeof m & { phone: string } => Boolean(m.phone));

  if (nudgeable.length === 0) {
    return { error: "Nobody on this trip has a phone number connected yet." };
  }

  const { data: answered } = await admin
    .from(stage === "availability" ? "planner_availability_marks" : "planner_preferences")
    .select("user_id")
    .eq("trip_id", trip.id);
  const answeredIds = new Set((answered ?? []).map((p) => p.user_id));

  const toNudge = nudgeable.filter((m) => !answeredIds.has(m.id));
  if (toNudge.length === 0) {
    return { error: "Everyone with a phone connected has already answered." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const link =
    stage === "availability"
      ? `${siteUrl}/planner/trips/${trip.id}/dates`
      : `${siteUrl}/planner/trips/${trip.id}/preferences`;
  const what = stage === "availability" ? "your dates" : "your preferences";

  // Logged once, on a successful send only — a failed attempt shouldn't
  // burn the trip's cooldown window. The send has already happened by the
  // time this runs, so a write failure here can't be undone — just logged,
  // so a missing cooldown window is at least visible in the logs.
  async function logNudge(targetCount: number) {
    const { error } = await admin
      .from("planner_nudge_log")
      .insert({ trip_id: trip.id, stage, mode, sent_by: nudgedBy, target_count: targetCount });
    if (error) console.error("nudge log write failed", error);
  }

  if (mode === "group") {
    try {
      const conversationSid = await getOrCreateTripConversation(admin, trip);
      const names = toNudge.map((m) => m.name?.split(" ")[0] || "someone").join(", ");
      await sendConversationMessage(
        conversationSid,
        `Still waiting on ${what} from ${names} for "${trip.name}". Answer here: ${link}`
      );
      await logNudge(toNudge.length);
      return { sentCount: 1 };
    } catch (e) {
      // The error goes back to a person (in the app, or texted into the
      // group) — log Twilio's wording, don't show it.
      console.error("group nudge failed", e);
      return { error: "Could not send the group nudge — try again in a bit." };
    }
  }

  // Individual texts are the one send path gated on notify_sms — the group
  // message above just names whoever's still pending, same as it always
  // has, regardless of their opt-in state.
  const toNudgeConsented = toNudge.filter((m) => m.notify_sms);

  let sentCount = 0;
  for (const member of toNudgeConsented) {
    try {
      const namePart = member.name ? ` ${member.name.split(" ")[0]}` : "";
      await sendUserText(
        member.phone as string,
        member.whatsapp_opt_in,
        `Hey${namePart}! "${trip.name}" still needs ${what}. Answer here: ${link}`
      );
      sentCount++;
    } catch {
      // Best-effort — keep nudging the rest even if one send fails.
    }
  }

  // Only a send that reached at least one person starts the cooldown — if
  // everyone's text failed (Twilio down), the next attempt shouldn't have
  // to wait a full window for a nudge that never actually went out.
  if (sentCount > 0) await logNudge(sentCount);

  return { sentCount };
}
