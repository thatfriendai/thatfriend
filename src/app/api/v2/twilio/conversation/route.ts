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
import { createTripFromText, joinTripByCode, looksLikeJoinCode } from "@/lib/planner/smsTripStart";
import { acceptPendingInviteByReply } from "@/lib/planner/joinLink";
import { invitePhoneToTrip, extractPhoneNumbers, looksLikeInviteList } from "@/lib/planner/invitePhone";
import { recordConsentEvent, handleOptKeywordFromBody } from "@/lib/planner/consent";
import * as say from "@/lib/planner/smsVoice";

const ASSISTANT_AUTHOR = "That Friend";

// Same shape as the 1:1 route's JOIN_CODE_PATTERN — a phone bound to this
// thread can't reach that route at all, so joining another trip by code
// has to work from here too.
const JOIN_CODE_PATTERN = /^(?:hello|hi|join)\s+([a-z0-9]{4,20})[.!?]*$/i;

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

  // Same as the 1:1 route: a throw anywhere below (an Anthropic 429, a
  // Supabase blip) would 500, Twilio's retry would bail on the claim
  // above, and the message would be lost without a word. Release the
  // claim and tell the sender privately instead.
  let author: Awaited<ReturnType<typeof findPlannerUserByPhone>> = null;
  try {
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
      author = userResult;
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

    let media: ConversationMedia[] = [];
    try {
      media = params.Media ? JSON.parse(params.Media) : [];
    } catch {
      media = [];
    }

    const groupTrip = { ...trip, twilio_conversation_sid: conversationSid };
    // SMS participants get the group's messages as ordinary texts, so the
    // same 1600-character limit applies — see capReply.
    const post = (text: string) => sendConversationMessage(conversationSid, say.capReply(text));
    // Personal replies — things that concern the sender, not the thread.
    const replyPrivately = (text: string) =>
      user?.phone
        ? sendSmsText(toE164(user.phone), say.capReply(text)).catch(() => {
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
    // mechanism, and it never reaches this webhook. Only the unambiguous
    // keywords count in here ("end", "cancel" are just words in a group
    // chat), and the confirmation goes to them alone — it's nobody else's
    // business, and posting it announced someone's opt-out to the group.
    if (body) {
      const optKeyword = await handleOptKeywordFromBody(admin, user, body, trip.id, { groupThread: true });
      if (optKeyword === "stop") {
        await replyPrivately(say.optedOutReply());
        return ok();
      }
      if (optKeyword === "start") {
        await replyPrivately(say.optedBackInReply());
        return ok();
      }
    }

    // "join LISBON4K" for a different trip — same deterministic branch as
    // the 1:1 route, answered privately. A "hi there" that happens to fit
    // the shape but isn't a code just carries on as a normal message.
    const joinMatch = body.match(JOIN_CODE_PATTERN);
    if (joinMatch && media.length === 0) {
      const joined = await joinTripByCode(admin, user, joinMatch[1]);
      if (joined.outcome === "joined" || joined.outcome === "already_member") {
        await replyPrivately(
          joined.outcome === "joined" ? say.joinedReply(joined.tripName) : say.alreadyMemberReply(joined.tripName)
        );
        return ok();
      }
      if (joined.outcome === "error") {
        console.error("[twilio/conversation] join by code failed", joined.error);
        await replyPrivately(say.lookupFailedReply());
        return ok();
      }
      if (/^join\b/i.test(body) && looksLikeJoinCode(joinMatch[1])) {
        await replyPrivately(say.joinCodeNotFoundReply());
        return ok();
      }
    }

    // A join code for another trip was handled above, so anything else
    // here is consent classified simply as a reply.
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
        await post(say.invitesSentReply(sent, trip.name, alreadyIn, invalid));
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
          console.error("[twilio/conversation] start trip failed", started.error);
          await replyPrivately(say.lookupFailedReply());
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
        await post(answer);
        return ok();
      }

      if (intent.kind === "nudge") {
        const nudged = await sendNudge(admin, groupTrip, "preferences", "group");
        if (!("error" in nudged)) return ok(); // sendNudge already messaged the group
        await post(nudged.error);
        return ok();
      }

      if (intent.kind === "close_decision") {
        await post(say.closeDecisionSoonReply());
        return ok();
      }
    }

    let result: Awaited<ReturnType<typeof addResourceFromWhatsAppText>> | null = null;

    if (media.length > 0 && chatServiceSid) {
      // Voice memos, videos, contact cards — nothing the screenshot reader
      // can use. Checked against every item, not just the first, since a
      // send can mix a photo with something else. Said privately: it's
      // only news to the sender.
      const images = media.filter((m) => !m.ContentType || m.ContentType.toLowerCase().startsWith("image/"));
      if (images.length === 0) {
        await replyPrivately(say.unsupportedMediaReply());
        return ok();
      }
      try {
        const downloaded = await Promise.all(
          images.map((m) => downloadConversationMedia(chatServiceSid, m.Sid))
        );
        result = await addResourceFromWhatsAppImage(admin, trip.id, user.id, downloaded);
      } catch (e) {
        result = { error: e instanceof Error ? e.message : "Could not download that image." };
      }
    } else if (body) {
      result = await addResourceFromWhatsAppText(admin, trip.id, user.id, body);
    } else {
      return ok();
    }

    if ("error" in result) {
      // A raw Twilio/Postgres message — for the logs, not the group.
      console.error("[twilio/conversation] save failed", result.error);
      await post(say.saveFailedReply());
      return ok();
    }

    if (result.places.length === 0 && result.alreadyAdded) {
      await post(say.alreadySavedReply());
    } else if (result.places.length === 0 && result.savedLinkOnly) {
      await post(say.linkSavedNoPlaceReply(trip.name));
    } else if (result.places.length > 0) {
      await post(say.placesAddedReply(trip.name, [], result.farAway));
    }

    return ok();
  } catch (e) {
    console.error("[twilio/conversation] inbound message failed", params.MessageSid, e);
    if (params.MessageSid) {
      await admin
        .from("planner_processed_messages")
        .delete()
        .eq("message_sid", params.MessageSid)
        .then(
          () => undefined,
          () => undefined
        );
    }
    if (author?.phone) await sendSmsText(toE164(author.phone), say.lookupFailedReply()).catch(() => undefined);
    return ok();
  }
}
