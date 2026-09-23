import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText, downloadWhatsAppMedia } from "@/lib/meta/client";
import { normalizePhoneDigits } from "@/lib/planner/phone";
import { findPlannerUserByPhone } from "@/lib/planner/plannerUser";
import { addResourceFromWhatsAppText, addResourceFromWhatsAppImage } from "@/lib/planner/whatsappResource";
import { capReply } from "@/lib/planner/smsVoice";

/** Meta's webhook subscription handshake — echoes hub.challenge back once the verify token matches. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

interface IncomingMessage {
  id?: string;
  from: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string };
}

function extractMessages(payload: unknown): IncomingMessage[] {
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return [];

  const messages: IncomingMessage[] = [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: { messages?: IncomingMessage[] } })?.value;
      if (Array.isArray(value?.messages)) messages.push(...value.messages);
    }
  }
  return messages;
}

/**
 * Meta signs every webhook POST with the app secret (X-Hub-Signature-256:
 * "sha256=<hex HMAC of the raw body>"). Without checking it, anyone who
 * found this URL could post a fake message "from" any member's number and
 * have it land in their trip. Must run on the raw bytes — re-serializing
 * parsed JSON changes them.
 */
function hasValidSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[whatsapp] META_APP_SECRET is not set — rejecting webhook. Set it to the Meta app's App Secret.");
      return false;
    }
    console.warn("[whatsapp] META_APP_SECRET is not set — accepting an unsigned webhook (dev only).");
    return true;
  }
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function replyTo(to: string, body: string) {
  try {
    // WhatsApp's own cap is 4096 characters.
    await sendWhatsAppText(to, capReply(body, 4000));
  } catch {
    // Best-effort — the message was still processed even if the reply failed to send.
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!hasValidSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = null;
  }
  const messages = extractMessages(payload);

  const admin = createAdminClient();

  for (const message of messages) {
    // Meta redelivers anything it didn't get a 200 for, and the extraction
    // below can outlast its timeout — same claim-first guard as the Twilio
    // webhooks, keyed on the wamid.
    if (message.id) {
      const { error: dupeError } = await admin.from("planner_processed_messages").insert({ message_sid: message.id });
      if (dupeError?.code === "23505") continue;
    }

    try {
      await handleMessage(admin, message);
    } catch (e) {
      // A 500 would make Meta retry the whole batch, re-running the
      // messages that did succeed. Log, release this one's claim, tell
      // them, and carry on with the rest.
      console.error("[whatsapp] inbound message failed", message.id, e);
      if (message.id) {
        await admin
          .from("planner_processed_messages")
          .delete()
          .eq("message_sid", message.id)
          .then(
            () => undefined,
            () => undefined
          );
      }
      await replyTo(normalizePhoneDigits(message.from), "Something went wrong on my end — try sending that again in a bit.");
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleMessage(admin: ReturnType<typeof createAdminClient>, message: IncomingMessage) {
  const fromDigits = normalizePhoneDigits(message.from);
  const user = await findPlannerUserByPhone(admin, fromDigits);

  if (!user) {
    await replyTo(
      fromDigits,
      "Hi! I don't recognize this number yet. Sign in at the web app first and opt into WhatsApp there — then forward me anything and it'll land in your trip."
    );
    return;
  }

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id, planner_trips(name)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    await replyTo(fromDigits, "You're signed in, but you're not part of any trips yet.");
    return;
  }

  const tripName =
    (membership.planner_trips as unknown as { name: string } | null)?.name ?? "your trip";

  let result: Awaited<ReturnType<typeof addResourceFromWhatsAppText>> | null = null;

  if (message.type === "text" && message.text?.body) {
    result = await addResourceFromWhatsAppText(admin, membership.trip_id, user.id, message.text.body);
  } else if (message.type === "image" && message.image?.id) {
    try {
      const { base64, mimeType } = await downloadWhatsAppMedia(message.image.id);
      result = await addResourceFromWhatsAppImage(admin, membership.trip_id, user.id, base64, mimeType);
    } catch (e) {
      result = { error: e instanceof Error ? e.message : "Could not download that image." };
    }
  } else {
    await replyTo(fromDigits, "I can only read text, links, and screenshots right now.");
    return;
  }

  if ("error" in result) {
    // The raw error is a Graph API/Postgres message — log it, don't send it.
    console.error("[whatsapp] save failed", result.error);
    await replyTo(fromDigits, "Couldn't save that one — something went wrong on my end. Try sending it again in a bit.");
    return;
  }

  if (result.places.length === 0) {
    await replyTo(fromDigits, `Didn't find any named places in that for "${tripName}".`);
  } else {
    const names = result.places.map((p) => p.name).join(", ");
    await replyTo(
      fromDigits,
      `Added to "${tripName}": ${names}. ${result.places.length === 1 ? "It's" : "They're"} on the map now.`
    );
  }
}
