#!/usr/bin/env node
/**
 * Plays an inbound text against the 1:1 webhook without a phone: signs the
 * request exactly the way Twilio would and prints the reply That Friend
 * would have texted back. Nothing is sent for the 1:1 route (the reply is
 * TwiML), but side effects are real — a "start a trip" creates a trip, and
 * numbers you text back DO get real invite texts (use Twilio's magic
 * numbers, +1 500 555 0006, to avoid that).
 *
 * Usage:
 *   node scripts/simulate-inbound.mjs "+15005550006" "hey, first time using that friend"
 *   node scripts/simulate-inbound.mjs "+12242969077" "is miami going to be expensive?" --local
 */
import { readFileSync } from "fs";
import twilio from "twilio";

const args = process.argv.slice(2);
const local = args.includes("--local");
const [from, ...rest] = args.filter((a) => a !== "--local");
const body = rest.join(" ");
if (!from || !body) {
  console.error('Usage: node scripts/simulate-inbound.mjs "+1XXXXXXXXXX" "message text" [--local]');
  process.exit(1);
}

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const base = local ? "http://localhost:3000" : "https://thatfriendapp.com";
const url = `${base}/api/v2/twilio`;
const params = {
  From: from,
  To: env.TWILIO_SMS_NUMBER,
  Body: body,
  NumMedia: "0",
  MessageSid: `SMsim${Date.now()}`,
};
const signature = twilio.getExpectedTwilioSignature(env.TWILIO_AUTH_TOKEN, url, params);

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "x-twilio-signature": signature },
  body: new URLSearchParams(params),
});
const text = await res.text();
const reply = text.match(/<Message>([\s\S]*?)<\/Message>/)?.[1];
console.log(`${res.status} ${from} -> "${body}"`);
console.log(reply ? `That Friend: ${reply.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"')}` : "(no reply — silent, or stepped aside for a group-thread phone)");
