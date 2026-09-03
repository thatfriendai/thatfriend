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

/** The real SMS/MMS-capable number (E.164), distinct from the WhatsApp sandbox number above. */
export function getSmsFrom() {
  const number = process.env.TWILIO_SMS_NUMBER;
  if (!number) throw new Error("TWILIO_SMS_NUMBER is not configured.");
  return number;
}

/** Downloads a Twilio media attachment (MMS image, etc.) — requires Basic Auth with the account's credentials. */
export async function downloadTwilioMedia(
  url: string
): Promise<{ base64: string; mimeType: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
    },
  });
  if (!res.ok) throw new Error(`Could not download media (${res.status}).`);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType };
}

/**
 * Downloads a Conversations message attachment by its media Sid, via
 * Twilio's Media Content Service. The Conversations SDK in this project
 * doesn't wrap this endpoint, so it's called directly — verify against
 * Twilio's current docs if this ever starts 404ing.
 */
export async function downloadConversationMedia(
  chatServiceSid: string,
  mediaSid: string
): Promise<{ base64: string; mimeType: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const res = await fetch(
    `https://mcs.us1.twilio.com/v1/Services/${chatServiceSid}/Media/${mediaSid}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Could not download media ${mediaSid} (${res.status}).`);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType };
}

/** Builds the public URL Twilio's request-signature check needs — same request as it saw, behind any tunnel/proxy. */
export function getPublicWebhookUrl(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}${url.pathname}${url.search}`;
  }
  return request.url;
}
