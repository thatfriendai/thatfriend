import { NextResponse } from "next/server";
import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadTwilioMedia, getPublicWebhookUrl } from "@/lib/twilio/client";
import { normalizePhoneDigits } from "@/lib/planner/phone";
import { findPlannerUserByPhone } from "@/lib/planner/plannerUser";
import { addResourceFromWhatsAppText, addResourceFromWhatsAppImage } from "@/lib/planner/whatsappResource";
import { classifyIntent } from "@/lib/planner/inboundIntent";
import { answerTripQuestion } from "@/lib/planner/tripQA";
import { sendNudge } from "@/lib/planner/nudge";
import { createTripFromText, joinTripByCode } from "@/lib/planner/smsTripStart";

// "hello LISBON4K", "hi LISBON4K", "join LISBON4K" — deterministic, not
// LLM-classified, since it's an exact code the app itself generated.
const JOIN_CODE_PATTERN = /^(?:hello|hi|join)\s+([a-z0-9]{4,20})$/i;

/**
 * Plain SMS/MMS webhook — handles anyone who isn't (yet) part of a trip's
 * group conversation. Twilio Conversations claims inbound messages from
 * known group participants before they ever reach this route (see
 * src/app/api/v2/twilio/conversation/route.ts); this only sees 1:1 DMs.
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

  const reply = (body: string) => {
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(body);
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  };
  // No TwiML <Message> at all — Twilio sends nothing back. Used for the
  // "found nothing" case: a share-sheet forward often arrives as two
  // separate texts (the link, then a caption typed alongside it), and
  // replying to *each one* meant a real success was always followed by a
  // confusing "didn't find any places" for the caption half. Genuine
  // failures (a bad link, an extraction error) still reply — this only
  // covers a clean, error-free "there was nothing here to find."
  const silent = () => new NextResponse(new twilio.twiml.MessagingResponse().toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });

  const isWhatsApp = (params.From ?? "").startsWith("whatsapp:");
  const fromDigits = normalizePhoneDigits(params.From ?? "");
  const body = (params.Body ?? "").trim();
  const numMedia = Number(params.NumMedia ?? "0");

  const admin = createAdminClient();

  // The extraction pipeline below can run past Twilio's response timeout,
  // which makes Twilio retry the same message — claim the sid first so a
  // retry bails out here instead of re-running everything and, e.g., adding
  // the same place twice.
  if (params.MessageSid) {
    const { error: dupeError } = await admin
      .from("planner_processed_messages")
      .insert({ message_sid: params.MessageSid });
    if (dupeError?.code === "23505") return silent();
  }

  let user: Awaited<ReturnType<typeof findPlannerUserByPhone>>;
  try {
    user = await findPlannerUserByPhone(admin, fromDigits);
  } catch {
    return reply("Something went wrong looking that up — try again in a bit.");
  }

  if (!user) {
    return reply(
      "Hi! I don't recognize this number yet. Sign in at the web app first — then text me anything and it'll land in your trip."
    );
  }

  // Texting the WhatsApp number is itself the clearest signal of channel
  // preference — flip it on so proactive sends (nudges, rating prompts)
  // follow suit. Best-effort: a failed update here shouldn't block the reply.
  if (isWhatsApp && !user.whatsapp_opt_in) {
    await admin.from("planner_users").update({ whatsapp_opt_in: true }).eq("id", user.id);
  }

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id, planner_trips(id, name, twilio_conversation_sid)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const trip = membership
    ? (membership.planner_trips as unknown as { id: string; name: string; twilio_conversation_sid: string | null } | null)
    : null;
  const tripName = trip?.name ?? "your trip";

  // These two — joining by code, and starting a brand-new trip — are the
  // only things that make sense with zero existing memberships, so they're
  // checked before the "not part of any trips yet" dead end below.
  if (body && !(numMedia > 0)) {
    const joinMatch = body.match(JOIN_CODE_PATTERN);
    if (joinMatch) {
      const joined = await joinTripByCode(admin, user, joinMatch[1]);
      if (joined.outcome === "joined") return reply(`You're in — welcome to "${joined.tripName}". Forward a link or place anytime.`);
      if (joined.outcome === "already_member") return reply(`You're already in "${joined.tripName}".`);
      if (joined.outcome === "not_found") {
        return reply("That code doesn't match any trip. Double-check it, or ask whoever sent it to resend it.");
      }
      return reply(`Hmm, ${joined.error}`);
    }

    const intent = await classifyIntent(body);

    if (intent.kind === "start_trip") {
      const started = await createTripFromText(admin, user, intent.destination);
      if ("error" in started) return reply(`Hmm, ${started.error}`);
      return reply(
        `Started "${started.tripName}"! Have your friends text "HELLO ${started.joinCode}" to this number to join — or open the app to add dates, invite by link, and more.`
      );
    }

    if (!membership) {
      return reply(
        'You\'re signed in, but you\'re not part of any trips yet. Text something like "start a trip to Lisbon" to begin one, or ask a friend for their join code and text "HELLO <code>".'
      );
    }

    if (intent.kind === "question") {
      const answer = await answerTripQuestion(admin, membership.trip_id, intent.topic, intent.dayRef);
      return reply(answer);
    }

    if (intent.kind === "nudge" && trip) {
      const nudged = await sendNudge(admin, trip, "preferences", "individual");
      if ("error" in nudged) return reply(nudged.error);
      return reply(
        nudged.sentCount === 0
          ? "Nobody to nudge right now."
          : `Nudged ${nudged.sentCount} ${nudged.sentCount === 1 ? "person" : "people"} about "${tripName}".`
      );
    }

    if (intent.kind === "close_decision") {
      return reply("Closing a poll by text is coming soon — head to the app to close this one.");
    }
  }

  if (!membership) {
    return reply(
      'You\'re signed in, but you\'re not part of any trips yet. Text something like "start a trip to Lisbon" to begin one, or ask a friend for their join code and text "HELLO <code>".'
    );
  }

  let result: Awaited<ReturnType<typeof addResourceFromWhatsAppText>> | null = null;

  if (numMedia > 0 && params.MediaUrl0) {
    try {
      const { base64, mimeType } = await downloadTwilioMedia(params.MediaUrl0);
      result = await addResourceFromWhatsAppImage(admin, membership.trip_id, user.id, base64, mimeType);
    } catch (e) {
      result = { error: e instanceof Error ? e.message : "Could not download that image." };
    }
  } else if (body) {
    result = await addResourceFromWhatsAppText(admin, membership.trip_id, user.id, body);
  } else {
    return reply("I can only read text, links, and photos right now.");
  }

  if ("error" in result) {
    return reply(`Hmm, ${result.error}`);
  }

  if (result.places.length === 0) {
    if (result.duplicates.length > 0) {
      return reply(
        `Already on the map for "${tripName}": ${result.duplicates.join(", ")}.`
      );
    }
    return silent();
  }

  const names = result.places.map((p) => p.name).join(", ");
  const dupNote =
    result.duplicates.length > 0
      ? ` (already had ${result.duplicates.join(", ")}.)`
      : "";
  const farNote =
    result.farAway.length > 0
      ? " " +
        result.farAway
          .map((f) => `Heads up — ${f.name}${f.address ? ` (${f.address})` : ""} doesn't look like it's near "${tripName}". Double check that's the right one.`)
          .join(" ")
      : "";
  return reply(
    `Added to "${tripName}": ${names}. ${result.places.length === 1 ? "It's" : "They're"} on the map now.${dupNote}${farNote}`
  );
}
