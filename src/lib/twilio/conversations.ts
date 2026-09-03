import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTwilioClient, getSmsFrom } from "./client";

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
    .select("planner_users(phone)")
    .eq("trip_id", trip.id);

  const phones = (members ?? [])
    .map((m) => (m.planner_users as unknown as { phone: string | null } | null)?.phone)
    .filter((p): p is string => Boolean(p));

  for (const phone of phones) {
    await addParticipantToConversation(conversation.sid, phone).catch(() => {
      // Best-effort — a member who fails to get added can still be synced later.
    });
  }

  return conversation.sid;
}
