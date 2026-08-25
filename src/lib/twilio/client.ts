import "server-only";
import twilio from "twilio";

export function createTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

/** The "whatsapp:+1..." sender identity configured in Twilio. */
export function getWhatsAppFrom() {
  const number = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!number) throw new Error("TWILIO_WHATSAPP_NUMBER is not configured.");
  return number.startsWith("whatsapp:") ? number : `whatsapp:${number}`;
}

export function toWhatsAppAddress(e164Number: string) {
  return `whatsapp:${e164Number}`;
}

/** Strips the "whatsapp:" scheme Twilio prefixes onto WhatsApp addresses. */
export function fromWhatsAppAddress(address: string) {
  return address.replace(/^whatsapp:/, "");
}
