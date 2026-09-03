import "server-only";
import { createTwilioClient, getSmsFrom } from "./client";

/** Sends a plain-text SMS/MMS via Twilio's Messages API. */
export async function sendSmsText(to: string, body: string): Promise<void> {
  await createTwilioClient().messages.create({
    from: getSmsFrom(),
    to,
    body,
  });
}
