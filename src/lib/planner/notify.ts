import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendUserText } from "@/lib/twilio/send";
import { getOrCreateTripConversation, sendConversationMessage } from "@/lib/twilio/conversations";

/**
 * Proactive, automatic texts — as opposed to nudge.ts (button-triggered)
 * and ratingCapture.ts (its own cron for one specific event). Kept to a
 * short list of events that actually block someone: dates locked, a
 * decision closed, a join request waiting on the owner. Everything else
 * stays in-app only (see homeAttention.ts / attention.ts).
 */

/** One short text to every phone-verified, notify_sms member of a trip. Best-effort. */
export async function notifyTrip(
  admin: SupabaseClient,
  trip: { id: string; name: string; twilio_conversation_sid: string | null },
  message: string
): Promise<void> {
  if (trip.twilio_conversation_sid) {
    try {
      const conversationSid = await getOrCreateTripConversation(admin, trip);
      await sendConversationMessage(conversationSid, message);
      return;
    } catch {
      // Fall through to individual sends if the group message fails.
    }
  }

  const { data: members } = await admin
    .from("planner_memberships")
    .select("planner_users(phone, whatsapp_opt_in, notify_sms)")
    .eq("trip_id", trip.id);

  const recipients = (members ?? [])
    .map((m) => m.planner_users as unknown as { phone: string | null; whatsapp_opt_in: boolean; notify_sms: boolean } | null)
    .filter((r): r is { phone: string; whatsapp_opt_in: boolean; notify_sms: boolean } => Boolean(r?.phone) && r!.notify_sms);

  for (const r of recipients) {
    try {
      await sendUserText(r.phone, r.whatsapp_opt_in, message);
    } catch {
      // Best-effort — keep going for the rest.
    }
  }
}

/** Texts one specific user directly, gated on notify_sms. Best-effort. */
export async function notifyUser(admin: SupabaseClient, userId: string, message: string): Promise<void> {
  const { data: u } = await admin
    .from("planner_users")
    .select("phone, whatsapp_opt_in, notify_sms")
    .eq("id", userId)
    .maybeSingle();
  if (!u?.phone || !u.notify_sms) return;
  try {
    await sendUserText(u.phone, u.whatsapp_opt_in, message);
  } catch {
    // Best-effort.
  }
}
