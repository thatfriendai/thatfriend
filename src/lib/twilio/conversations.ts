import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTwilioClient, getSmsFrom } from "./client";
import { sendUserText } from "./send";

/** Twilio error code for "this participant/address is already in the conversation." */
const ALREADY_PARTICIPANT = 50416;

function getMessagingServiceSid() {
  const sid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid) throw new Error("TWILIO_MESSAGING_SERVICE_SID is not configured.");
  return sid;
}

/** Adds a phone number as an SMS participant of a trip's group conversation. Idempotent. */
export async function addParticipantToConversation(conversationSid: string, phoneE164: string) {
  try {
    await createTwilioClient()
      .conversations.v1.conversations(conversationSid)
      .participants.create({
        "messagingBinding.address": phoneE164,
        "messagingBinding.proxyAddress": getSmsFrom(),
      });
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code !== ALREADY_PARTICIPANT) throw e;
  }
}

/**
 * Removes a phone number from a trip's group conversation, so texts there
 * stop reaching them immediately (P1-B) — the membership row's own status
 * alone doesn't do that, Twilio is the actual source of truth for who's
 * bound to the thread. A no-op if they were never a participant.
 */
export async function removeParticipantFromConversation(conversationSid: string, phoneE164: string) {
  const client = createTwilioClient();
  const participants = await client.conversations.v1.conversations(conversationSid).participants.list();
  const match = participants.find(
    (p) => (p.messagingBinding as { address?: string } | null)?.address === phoneE164
  );
  if (!match) return;
  await client.conversations.v1.conversations(conversationSid).participants(match.sid).remove();
}

/**
 * Whether this phone is currently bound (through our SMS number) to any
 * active group conversation. When it is, Twilio delivers the person's
 * texts into that Conversation — and, with the number's own inbound
 * webhook also configured, to the 1:1 webhook as well. The 1:1 route uses
 * this to step aside so one text doesn't get two replies.
 */
export async function isConversationParticipant(phoneE164: string): Promise<boolean> {
  const proxy = getSmsFrom();
  const rows = await createTwilioClient().conversations.v1.participantConversations.list({
    address: phoneE164,
    limit: 20,
  });
  return rows.some(
    (row) =>
      row.conversationState === "active" &&
      (row.participantMessagingBinding as { proxy_address?: string } | null)?.proxy_address === proxy
  );
}

/** Posts an assistant-authored message into a trip's group conversation. */
export async function sendConversationMessage(conversationSid: string, body: string) {
  await createTwilioClient()
    .conversations.v1.conversations(conversationSid)
    .messages.create({ author: "That Friend", body });
}

interface TripForConversation {
  id: string;
  name: string;
  twilio_conversation_sid: string | null;
}

/**
 * Returns the trip's group conversation, creating it (and adding every
 * phone-verified member) the first time it's needed.
 */
export async function getOrCreateTripConversation(
  admin: SupabaseClient,
  trip: TripForConversation
): Promise<string> {
  if (trip.twilio_conversation_sid) return trip.twilio_conversation_sid;

  const conversation = await createTwilioClient().conversations.v1.conversations.create({
    friendlyName: trip.name,
    messagingServiceSid: getMessagingServiceSid(),
  });

  await admin
    .from("planner_trips")
    .update({ twilio_conversation_sid: conversation.sid })
    .eq("id", trip.id);

  const { data: members } = await admin
    .from("planner_memberships")
    .select("user_id, planner_users(phone)")
    .eq("trip_id", trip.id);

  const withPhone = (members ?? [])
    .map((m) => ({
      userId: m.user_id as string,
      phone: (m.planner_users as unknown as { phone: string | null } | null)?.phone,
    }))
    .filter((m): m is { userId: string; phone: string } => Boolean(m.phone));

  // Twilio only allows one active Conversation binding per phone number
  // through this proxy — someone already bound to another trip's group
  // thread can't also be added to this one (their texts there would never
  // reach it). Best-effort otherwise too, but this specific, expected
  // failure is worth telling the organizer about instead of losing silently.
  const unreachable: string[] = [];
  for (const member of withPhone) {
    try {
      await addParticipantToConversation(conversation.sid, member.phone);
    } catch (e) {
      console.error("[conversations] couldn't add participant", trip.id, member.userId, e);
      unreachable.push(member.userId);
    }
  }

  if (unreachable.length > 0) {
    const { data: names } = await admin.from("planner_users").select("id, name, email").in("id", unreachable);
    const label = (names ?? [])
      .map((n) => n.name?.split(" ")[0] || n.email?.split("@")[0] || "someone")
      .join(", ");
    const { data: owner } = await admin
      .from("planner_memberships")
      .select("planner_users(id, phone, whatsapp_opt_in, notify_sms)")
      .eq("trip_id", trip.id)
      .eq("role", "owner")
      .maybeSingle();
    const ownerUser = owner?.planner_users as unknown as
      | { id: string; phone: string | null; whatsapp_opt_in: boolean; notify_sms: boolean }
      | null;
    if (ownerUser?.phone && ownerUser.notify_sms) {
      await sendUserText(
        ownerUser.phone,
        ownerUser.whatsapp_opt_in,
        `heads up — ${label} won't get ${trip.name}'s group texts. they're already in another trip's group thread on the same number, so this one can't reach them there too.`
      ).catch(() => {
        // Best-effort — the console.error above is the durable record.
      });
    }
  }

  return conversation.sid;
}
