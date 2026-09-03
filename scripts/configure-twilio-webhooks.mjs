#!/usr/bin/env node
/**
 * One-off setup: points the SMS number's inbound webhook and the
 * Conversations Service's onMessageAdded webhook at a base URL (your prod
 * domain, or an ngrok tunnel for local dev). Run again any time that base
 * URL changes.
 *
 * Usage: node scripts/configure-twilio-webhooks.mjs https://your-domain.com
 */
import { readFileSync } from "fs";
import twilio from "twilio";

const baseUrl = process.argv[2];
if (!baseUrl || !/^https:\/\//.test(baseUrl)) {
  console.error("Usage: node scripts/configure-twilio-webhooks.mjs https://your-domain.com");
  process.exit(1);
}

function loadEnvLocal() {
  const lines = readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n");
  const env = {};
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

const env = loadEnvLocal();
const accountSid = env.TWILIO_ACCOUNT_SID;
const authToken = env.TWILIO_AUTH_TOKEN;
const smsNumber = env.TWILIO_SMS_NUMBER;
const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;

if (!accountSid || !authToken || !smsNumber || !messagingServiceSid) {
  console.error(
    "Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_SMS_NUMBER / TWILIO_MESSAGING_SERVICE_SID in .env.local"
  );
  process.exit(1);
}

const client = twilio(accountSid, authToken);

async function main() {
  const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: smsNumber, limit: 1 });
  if (numbers.length === 0) {
    throw new Error(`${smsNumber} isn't a number on this account.`);
  }
  await client.incomingPhoneNumbers(numbers[0].sid).update({
    smsUrl: `${baseUrl}/api/v2/twilio`,
    smsMethod: "POST",
  });
  console.log(`Set ${smsNumber}'s inbound webhook -> ${baseUrl}/api/v2/twilio`);

  const services = await client.conversations.v1.services.list({ limit: 20 });
  if (services.length === 0) {
    throw new Error("No Conversations Service found on this account.");
  }
  const service = services[0];
  await client.conversations.v1.services(service.sid).configuration.webhooks().update({
    postWebhookUrl: `${baseUrl}/api/v2/twilio/conversation`,
    method: "POST",
    filters: ["onMessageAdded"],
  });
  console.log(
    `Set Conversations Service ${service.sid}'s onMessageAdded webhook -> ${baseUrl}/api/v2/twilio/conversation`
  );
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
