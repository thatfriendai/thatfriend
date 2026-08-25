import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import twilio from "twilio";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { logPreferencesFromText } from "@/lib/preferences";
import { fromWhatsAppAddress } from "@/lib/twilio/client";

function getPublicUrl(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}${url.pathname}${url.search}`;
  }
  return request.url;
}

const CONNECT_CODE_PATTERN = /^[A-Z0-9]{6}$/;

async function handleConnectCode(
  admin: SupabaseClient,
  from: string,
  code: string
): Promise<string | null> {
  const { data: connectCode } = await admin
    .from("whatsapp_connect_codes")
    .select("id, trip_id, participant_id")
    .eq("code", code)
    .maybeSingle();

  if (!connectCode) return null;

  // A phone can only be linked to one participant at a time — move it.
  await admin.from("participants").update({ phone_number: null }).eq("phone_number", from);

  const { data: participant } = await admin
    .from("participants")
    .update({ phone_number: from })
    .eq("id", connectCode.participant_id)
    .select("name")
    .maybeSingle();

  await admin.from("whatsapp_connect_codes").delete().eq("id", connectCode.id);

  const { data: trip } = await admin
    .from("trips")
    .select("name")
    .eq("id", connectCode.trip_id)
    .maybeSingle();

  revalidatePath(`/trip/${connectCode.trip_id}`);

  return `You're connected${participant?.name ? `, ${participant.name}` : ""}! Text me anything about "${trip?.name ?? "your trip"}" — dates, budget, vetoes — and I'll log it.`;
}

async function handleIncomingMessage(
  admin: SupabaseClient,
  from: string,
  body: string
): Promise<string> {
  if (!from || !body) {
    return "Sorry, I didn't catch that — try sending a text message.";
  }

  const maybeCode = body.trim().toUpperCase();
  if (CONNECT_CODE_PATTERN.test(maybeCode)) {
    const connectReply = await handleConnectCode(admin, from, maybeCode);
    if (connectReply) return connectReply;
  }

  const { data: participant } = await admin
    .from("participants")
    .select("id, trip_id, name")
    .eq("phone_number", from)
    .maybeSingle();

  if (!participant) {
    return 'Hi! I don\'t recognize this number yet. Open your trip page on the web, tap "Connect WhatsApp," and text me the code you get there.';
  }

  const result = await logPreferencesFromText(admin, participant.trip_id, participant.id, body);

  if ("error" in result) {
    return `Hmm, ${result.error}`;
  }

  revalidatePath(`/trip/${participant.trip_id}`);

  const summary = result.extracted
    .map((pref) => `${pref.category} (${pref.type}): ${pref.value}`)
    .join("\n");
  return `Got it — logged:\n${summary}`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const publicUrl = getPublicUrl(request);

  if (!authToken || !twilio.validateRequest(authToken, signature, publicUrl, params)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const from = fromWhatsAppAddress(params.From ?? "");
  const body = (params.Body ?? "").trim();

  const admin = createAdminClient();
  const reply = await handleIncomingMessage(admin, from, body);

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(reply);

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
