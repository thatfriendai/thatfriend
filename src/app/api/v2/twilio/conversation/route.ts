import { NextResponse } from "next/server";
import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadConversationMedia, getPublicWebhookUrl } from "@/lib/twilio/client";
import { sendConversationMessage } from "@/lib/twilio/conversations";
import { sendSmsText } from "@/lib/twilio/send";
import { normalizePhoneDigits, toE164 } from "@/lib/planner/phone";
import { findPlannerUserByPhone } from "@/lib/planner/plannerUser";
import { addResourceFromWhatsAppText, addResourceFromWhatsAppImage } from "@/lib/planner/whatsappResource";
import { classifyIntent } from "@/lib/planner/inboundIntent";
import { answerTripQuestion } from "@/lib/planner/tripQA";
import { sendNudge } from "@/lib/planner/nudge";
import { createTripFromText } from "@/lib/planner/smsTripStart";
import { acceptPendingInviteByReply } from "@/lib/planner/joinLink";
import { invitePhoneToTrip, extractPhoneNumbers, looksLikeInviteList } from "@/lib/planner/invitePhone";
import { recordConsentEvent, handleOptKeywordFromBody } from "@/lib/planner/consent";
import * as say from "@/lib/planner/smsVoice";

const ASSISTANT_AUTHOR = "That Friend";

interface ConversationMedia {
  Sid: string;
  ContentType: string;
}

/**
 * Twilio Conversations' onMessageAdded webhook — fires for every message in
 * a trip's group thread, including the ones we send back into it. A phone
 * can only be bound to one Conversation through our number, so once
 * someone's in a group thread, everything they text lands here — the
 * personal cases (a "1" back to an invite, starting a new trip) are
 * answered with a 1:1 text rather than into the group. Anyone NOT bound to
 * a Conversation lands in src/app/api/v2/twilio/route.ts instead.
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
  const ok = () => NextResponse.json({ ok: true });

  const admin = createAdminClient();

  // Same retry guard as the 1:1 route — the extraction pipeline can outlast
  // Twilio's timeout, and a retry of the same message would otherwise pass
  // the dedup check twice and add the same place twice.
  if (params.MessageSid) {
    const { error: dupeError } = await admin
      .from("planner_processed_messages")
      .insert({ message_sid: params.MessageSid });
    if (dupeError?.code === "23505") return ok();
  }

  let trip: { id: string; name: string; destination: string | null; join_code: string | null } | null = null;
  let user: Awaited<ReturnType<typeof findPlannerUserByPhone>> = null;
  try {
    const [tripResult, userResult] = await Promise.all([
      admin
        .from("planner_trips")
        .select("id, name, destination, join_code")
        .eq("twilio_conversation_sid", conversationSid)
        .maybeSingle(),
      findPlannerUserByPhone(admin, fromDigits),
    ]);
    trip = tripResult.data;
    user = userResult;
  } catch {
    // A lookup failure here has no one obvious to reply to (could be the
    // trip query or the phone query) — stay quiet rather than guess.
    return ok();
  }

  if (!trip || !user) {
    // A message in a conversation we don't recognize, or from a number we
    // can't match to an account — nothing sane to do, stay quiet.
    return ok();
  }

  const groupTrip = { ...trip, twilio_conversation_sid: conversationSid };
  // Personal replies — things that concern the sender, not the thread.
  const replyPrivately = (text: string) =>
    user?.phone
      ? sendSmsText(toE164(user.phone), text).catch(() => {
          // Best-effort — the action itself already happened.
        })
      : Promise.resolve();

  // A "1"/"START" back to an invite for ANOTHER trip arrives here because
  // this phone is bound to this thread — join them to the trip they were
  // actually invited to, and tell them so privately.
  if (body) {
    const accepted = await acceptPendingInviteByReply(admin, user, body);
    if (accepted?.outcome === "joined") {
      await replyPrivately(say.joinedReply(accepted.tripName));
      return ok();
    }
    if (accepted?.outcome === "already_member") {
      await replyPrivately(say.alreadyMemberReply(accepted.tripName));
      return ok();
    }
  }

  // STOP/START as a plain message body — see the 1:1 webhook's identical
  // backstop comment; the Messaging Service's OptOutType is the reliable
  // mechanism, and it never reaches this webhook.
  if (body) {
    const optKeyword = await handleOptKeywordFromBody(admin, user, body, trip.id);
    if (optKeyword === "stop") {
      await sendConversationMessage(conversationSid, say.optedOutReply());
      return ok();
    }
    if (optKeyword === "start") {
      await sendConversationMessage(conversationSid, say.optedBackInReply());
      return ok();
    }
  }

  // No join-code concept inside a group thread (you're already in), so any
  // inbound message here is consent classified simply as a reply.
  await recordConsentEvent(admin, user, "inbound_reply", trip.id);

  if (body) {
    // Phone numbers texted into the thread invite those people to this
    // trip — deterministic, ahead of the classifier (see the 1:1 route).
    const phones = extractPhoneNumbers(body);
    if (looksLikeInviteList(body, phones)) {
      const { data: sender } = await admin.from("planner_users").select("name").eq("id", user.id).maybeSingle();
      const organizerName = sender?.name?.split(" ")[0] || "A friend";
      let sent = 0;
      let alreadyIn = 0;
      let invalid = 0;
      for (const phone of phones) {
        const result = await invitePhoneToTrip(admin, groupTrip, organizerName, phone);
        if (result.status === "sent" || result.status === "sent_returning") sent++;
        else if (result.status === "already_member") alreadyIn++;
        else if (result.status === "invalid") invalid++;
      }
      await sendConversationMessage(conversationSid, say.invitesSentReply(sent, trip.name, alreadyIn, invalid));
      return ok();
    }

    const intent = await classifyIntent(body, { hasTrips: true });

    // People talk to each other in here — a "hey" isn't for us.
    if (intent.kind === "chat") return ok();

    if (intent.kind === "start_trip") {
      if (!intent.destination) {
        await replyPrivately(say.pickDestinationReply());
        return ok();
      }
      const started = await createTripFromText(admin, user, intent.destination);
      if ("error" in started) {
        await replyPrivately(`hmm, ${started.error}`);
        return ok();
      }
      // Their phone stays bound to THIS thread, so the new trip can't be
      // texted into from here — say so, and point at where it lives.
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      await replyPrivately(
        say.tripStartedFromGroupReply(intent.destination, intent.when, trip.name, `${siteUrl}/planner/trips/${started.tripId}`)
      );
      return ok();
    }

    if (intent.kind === "question") {
      const answer = await answerTripQuestion(admin, trip.id, intent.topic, intent.dayRef);
      await sendConversationMessage(conversationSid, answer);
      return ok();
    }

    if (intent.kind === "nudge") {
      const nudged = await sendNudge(admin, groupTrip, "preferences", "group");
      if (!("error" in nudged)) return ok(); // sendNudge already messaged the group
      await sendConversationMessage(conversationSid, nudged.error);
      return ok();
    }

    if (intent.kind === "close_decision") {
      await sendConversationMessage(conversationSid, say.closeDecisionSoonReply());
      return ok();
    }
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
    return ok();
  }

  if ("error" in result) {
    await sendConversationMessage(conversationSid, `hmm, ${result.error}`);
    return ok();
  }

  if (result.places.length === 0 && result.alreadyAdded) {
    await sendConversationMessage(conversationSid, say.alreadySavedReply());
  } else if (result.places.length === 0 && result.savedLinkOnly) {
    await sendConversationMessage(conversationSid, say.linkSavedNoPlaceReply(trip.name));
  } else if (result.places.length > 0) {
    await sendConversationMessage(conversationSid, say.placesAddedReply(trip.name, [], result.farAway));
  }

  return ok();
}
