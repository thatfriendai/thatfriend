import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText, downloadWhatsAppMedia } from "@/lib/meta/client";
import { normalizePhoneDigits } from "@/lib/planner/phone";
import { findPlannerUserByPhone } from "@/lib/planner/plannerUser";
import { addResourceFromWhatsAppText, addResourceFromWhatsAppImage } from "@/lib/planner/whatsappResource";

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

async function replyTo(to: string, body: string) {
  try {
    await sendWhatsAppText(to, body);
  } catch {
    // Best-effort — the message was still processed even if the reply failed to send.
  }
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const messages = extractMessages(payload);

  const admin = createAdminClient();

  for (const message of messages) {
    const fromDigits = normalizePhoneDigits(message.from);
    const user = await findPlannerUserByPhone(admin, fromDigits);

    if (!user) {
      await replyTo(
        fromDigits,
        "Hi! I don't recognize this number yet. Sign in at the web app first and opt into WhatsApp there — then forward me anything and it'll land in your trip."
      );
      continue;
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
      continue;
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
      continue;
    }

    if ("error" in result) {
      await replyTo(fromDigits, `Hmm, ${result.error}`);
      continue;
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

  return NextResponse.json({ ok: true });
}
