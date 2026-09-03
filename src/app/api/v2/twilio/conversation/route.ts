import { NextResponse } from "next/server";
import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadConversationMedia, getPublicWebhookUrl } from "@/lib/twilio/client";
import { sendConversationMessage } from "@/lib/twilio/conversations";
import { normalizePhoneDigits } from "@/lib/planner/phone";
import { findPlannerUserByPhone } from "@/lib/planner/plannerUser";
import { addResourceFromWhatsAppText, addResourceFromWhatsAppImage } from "@/lib/planner/whatsappResource";

const ASSISTANT_AUTHOR = "That Friend";

interface ConversationMedia {
  Sid: string;
  ContentType: string;
}

/**
 * Twilio Conversations' onMessageAdded webhook — fires for every message in
 * a trip's group thread, including the ones we send back into it. Anyone
 * texting the number who ISN'T yet a participant of a conversation lands in
 * src/app/api/v2/twilio/route.ts instead; Twilio claims the message here
 * once they're a known SMS participant.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const publicUrl = getPublicWebhookUrl(request);

  if (!authToken || !twilio.validateRequest(authToken, signature, publicUrl, params)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  if (params.EventType && params.EventType !== "onMessageAdded") {
    return NextResponse.json({ ok: true });
  }

  // Our own replies fire this webhook too — skip them or we'd loop forever.
  if (params.Author === ASSISTANT_AUTHOR) {
    return NextResponse.json({ ok: true });
  }

  const conversationSid = params.ConversationSid;
  const chatServiceSid = params.ChatServiceSid;
  const fromDigits = normalizePhoneDigits(params.Author ?? "");
  const body = (params.Body ?? "").trim();

  const admin = createAdminClient();

  const [{ data: trip }, user] = await Promise.all([
    admin
      .from("planner_trips")
      .select("id, name")
      .eq("twilio_conversation_sid", conversationSid)
      .maybeSingle(),
    findPlannerUserByPhone(admin, fromDigits),
  ]);

  if (!trip || !user) {
    // A message in a conversation we don't recognize, or from a number we
    // can't match to an account — nothing sane to do, stay quiet.
    return NextResponse.json({ ok: true });
  }

  let media: ConversationMedia[] = [];
  try {
    media = params.Media ? JSON.parse(params.Media) : [];
  } catch {
    media = [];
  }

  let result: Awaited<ReturnType<typeof addResourceFromWhatsAppText>> | null = null;

  if (media.length > 0 && chatServiceSid) {
    try {
      const { base64, mimeType } = await downloadConversationMedia(chatServiceSid, media[0].Sid);
      result = await addResourceFromWhatsAppImage(admin, trip.id, user.id, base64, mimeType);
    } catch (e) {
      result = { error: e instanceof Error ? e.message : "Could not download that image." };
    }
  } else if (body) {
    result = await addResourceFromWhatsAppText(admin, trip.id, user.id, body);
  } else {
    return NextResponse.json({ ok: true });
  }

  if ("error" in result) {
    await sendConversationMessage(conversationSid, `Hmm, ${result.error}`);
    return NextResponse.json({ ok: true });
  }

  if (result.places.length > 0) {
    const names = result.places.map((p) => p.name).join(", ");
    await sendConversationMessage(
      conversationSid,
      `Added to the map: ${names}. ${result.places.length === 1 ? "It's" : "They're"} in "${trip.name}" now.`
    );
  }

  return NextResponse.json({ ok: true });
}
