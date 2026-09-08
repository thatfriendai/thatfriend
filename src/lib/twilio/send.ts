import "server-only";
import { createTwilioClient, getSmsFrom, getWhatsAppSender, toWhatsAppAddress } from "./client";
import { toE164 } from "@/lib/planner/phone";

/** Twilio error code for "outside the 24h WhatsApp session window — use a Template." */
const OUTSIDE_WHATSAPP_WINDOW = 63016;

/** Sends a plain-text SMS/MMS via Twilio's Messages API. */
export async function sendSmsText(to: string, body: string): Promise<void> {
  await createTwilioClient().messages.create({
    from: getSmsFrom(),
    to,
    body,
  });
}

/** Sends a plain-text WhatsApp message via Twilio's real (non-sandbox) WhatsApp Sender. */
export async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  await createTwilioClient().messages.create({
    from: toWhatsAppAddress(getWhatsAppSender()),
    to: toWhatsAppAddress(to),
    body,
  });
}

/**
 * The one place that owns the SMS-vs-WhatsApp decision for a 1:1 proactive
 * send (nudges, rating prompts). WhatsApp business-initiated messages sent
 * outside a 24h session window need a pre-approved Template — we don't have
 * one, so a 63016 falls back to SMS rather than losing the message.
 */
export async function sendUserText(phone: string, whatsappOptIn: boolean, body: string): Promise<void> {
  const e164 = toE164(phone);
  if (!whatsappOptIn) {
    await sendSmsText(e164, body);
    return;
  }
  try {
    await sendWhatsAppMessage(e164, body);
  } catch (e) {
    if ((e as { code?: number }).code !== OUTSIDE_WHATSAPP_WINDOW) throw e;
    await sendSmsText(e164, body);
  }
}
