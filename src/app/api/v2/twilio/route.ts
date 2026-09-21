import { NextResponse } from "next/server";
import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadTwilioMedia, getPublicWebhookUrl } from "@/lib/twilio/client";
import { isConversationParticipant } from "@/lib/twilio/conversations";
import { normalizePhoneDigits, toE164 } from "@/lib/planner/phone";
import { findPlannerUserByPhone } from "@/lib/planner/plannerUser";
import { addResourceFromWhatsAppText, addResourceFromWhatsAppImage } from "@/lib/planner/whatsappResource";
import { classifyIntent } from "@/lib/planner/inboundIntent";
import { answerTripQuestion } from "@/lib/planner/tripQA";
import { sendNudge } from "@/lib/planner/nudge";
import { createTripFromText, joinTripByCode } from "@/lib/planner/smsTripStart";
import { acceptPendingInviteByReply, findPendingInvite } from "@/lib/planner/joinLink";
import { invitePhoneToTrip, extractPhoneNumbers, looksLikeInviteList } from "@/lib/planner/invitePhone";
import { recordConsentEvent, handleOptKeywordFromBody, applyOptKeyword, type ConsentMethod } from "@/lib/planner/consent";
import * as say from "@/lib/planner/smsVoice";

// "hello LISBON4K", "hi LISBON4K", "join LISBON4K" — deterministic, not
// LLM-classified, since it's an exact code the app itself generated.
const JOIN_CODE_PATTERN = /^(?:hello|hi|join)\s+([a-z0-9]{4,20})$/i;

/**
 * Plain SMS/MMS webhook — the 1:1 thread with That Friend. Anyone bound to
 * a trip's group Conversation has their texts handled by
 * src/app/api/v2/twilio/conversation/route.ts instead (Twilio delivers to
 * both; this route steps aside for them, see below).
 *
 * This is also where Twilio's Messaging Service inbound webhook points, so
 * a STOP/START that Advanced Opt-Out already handled arrives here with
 * OptOutType set — see scripts/configure-twilio-webhooks.mjs.
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
    return reply(say.lookupFailedReply());
  }

  // A STOP/START the Messaging Service's Advanced Opt-Out already handled:
  // Twilio has sent its own confirmation (and for STOP, blocks anything
  // we'd send), so just mirror the state and say nothing.
  const optOutType = (params.OptOutType ?? "").toUpperCase();
  if (optOutType === "STOP" || optOutType === "START") {
    if (user) await applyOptKeyword(admin, user, optOutType === "STOP" ? "stop" : "start");
    return silent();
  }

  if (!user) {
    return reply(say.unknownNumberReply(siteUrl));
  }

  // Texting the WhatsApp number is itself the clearest signal of channel
  // preference — flip it on so proactive sends (nudges, rating prompts)
  // follow suit. Best-effort: a failed update here shouldn't block the reply.
  if (isWhatsApp && !user.whatsapp_opt_in) {
    await admin.from("planner_users").update({ whatsapp_opt_in: true }).eq("id", user.id);
  }

  // Someone in a trip's group thread: Twilio has also dropped this same
  // text into that Conversation, whose webhook answers there (and handles
  // the personal cases — a "1" to an invite, starting a trip — with a 1:1
  // text of its own). Answering here too is what produced two identical
  // replies to one question. Best-effort: if Twilio can't be asked, carry
  // on rather than go silent on someone who may have no thread at all.
  if (!isWhatsApp && user.phone) {
    const inGroupThread = await isConversationParticipant(toE164(user.phone)).catch(() => false);
    if (inGroupThread) return silent();
  }

  // Bare "1"/"START" replying to a pending per-phone invite joins that
  // trip directly. Checked before the STOP/START backstop below, which
  // would otherwise swallow "start" as a bare re-opt-in and never join
  // them to anything.
  if (body) {
    const accepted = await acceptPendingInviteByReply(admin, user, body);
    if (accepted?.outcome === "joined") return reply(say.joinedReply(accepted.tripName));
    if (accepted?.outcome === "already_member") return reply(say.alreadyMemberReply(accepted.tripName));
    // not_found/error here would mean the invite's trip vanished under
    // us — fall through to normal handling rather than dead-ending.
  }

  // STOP/START as a plain message body — Twilio's Advanced Opt-Out normally
  // intercepts these before they ever reach here (arriving as OptOutType,
  // handled above); this is only a backstop, checked before anything could
  // mistake either word for a join code or a resource to save.
  if (body) {
    const optKeyword = await handleOptKeywordFromBody(admin, user, body);
    if (optKeyword === "stop") return reply(say.optedOutReply());
    if (optKeyword === "start") return reply(say.optedBackInReply());
  }

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id, planner_trips(id, name, destination, join_code, twilio_conversation_sid)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const trip = membership
    ? (membership.planner_trips as unknown as {
        id: string;
        name: string;
        destination: string | null;
        join_code: string | null;
        twilio_conversation_sid: string | null;
      } | null)
    : null;
  const tripName = trip?.name ?? "your trip";

  // Any inbound message from here on is itself affirmative consent —
  // classify how (a tracked join-link tap, a bare join code, or just a
  // reply) before acting on it, so the audit log records why.
  if (body) {
    const joinMatch = body.match(JOIN_CODE_PATTERN);
    let method: ConsentMethod = "inbound_reply";
    let consentTripId: string | null = trip?.id ?? null;
    if (joinMatch) {
      method = "join_code";
      const code = joinMatch[1].trim().toUpperCase();
      const { data: codeTrip } = await admin.from("planner_trips").select("id").eq("join_code", code).maybeSingle();
      consentTripId = codeTrip?.id ?? null;
      if (codeTrip && user.phone) {
        const { data: trackedInvite } = await admin
          .from("planner_trip_invites")
          .select("id")
          .eq("trip_id", codeTrip.id)
          .eq("phone", toE164(user.phone))
          .not("clicked_at", "is", null)
          .maybeSingle();
        if (trackedInvite) method = "link_tap";
      }
    }
    await recordConsentEvent(admin, user, method, consentTripId);
  } else if (numMedia > 0) {
    await recordConsentEvent(admin, user, "inbound_reply", trip?.id ?? null);
  }

  if (body && !(numMedia > 0)) {
    const joinMatch = body.match(JOIN_CODE_PATTERN);
    if (joinMatch) {
      const joined = await joinTripByCode(admin, user, joinMatch[1]);
      if (joined.outcome === "joined") return reply(say.joinedReply(joined.tripName));
      if (joined.outcome === "already_member") return reply(say.alreadyMemberReply(joined.tripName));
      if (joined.outcome === "not_found") return reply(say.joinCodeNotFoundReply());
      return reply(`hmm, ${joined.error}`);
    }

    // "who's coming? text me their numbers" — a text that's mostly phone
    // numbers is the answer to that, and it goes to the trip they most
    // recently joined or started. Deterministic, ahead of the classifier.
    const phones = extractPhoneNumbers(body);
    if (looksLikeInviteList(body, phones)) {
      if (!trip) return reply(say.invitesNeedTripReply());
      const organizerName = await organizerFirstName(admin, user.id);
      let sent = 0;
      let alreadyIn = 0;
      let invalid = 0;
      for (const phone of phones) {
        const result = await invitePhoneToTrip(admin, trip, organizerName, phone);
        if (result.status === "sent" || result.status === "carried_over") sent++;
        else if (result.status === "already_member") alreadyIn++;
        else if (result.status === "invalid") invalid++;
      }
      return reply(say.invitesSentReply(sent, tripName, alreadyIn, invalid));
    }

    const intent = await classifyIntent(body, { hasTrips: Boolean(membership) });

    if (intent.kind === "chat") {
      if (intent.tone === "thanks") return reply(say.thanksReply());
      if (intent.tone !== "greeting") return silent();
      if (trip) return reply(say.returningGreetingReply(tripName));
      const pendingInvite = await findPendingInvite(admin, user);
      if (pendingInvite) return reply(say.invitedGreetingReply(pendingInvite.organizerFirstName, pendingInvite.tripName));
      return reply(say.firstTimeGreetingReply());
    }

    if (intent.kind === "start_trip") {
      // "no idea yet, help me pick" — keep asking the one question, with
      // somewhere to start, rather than creating a trip called "New trip".
      if (!intent.destination) return reply(say.pickDestinationReply());
      const started = await createTripFromText(admin, user, intent.destination);
      if ("error" in started) return reply(`hmm, ${started.error}`);
      return reply(say.tripStartedReply(intent.destination, intent.when));
    }

    if (!membership) {
      return reply(say.noTripYetReply());
    }

    if (intent.kind === "question") {
      const answer = await answerTripQuestion(admin, membership.trip_id, intent.topic, intent.dayRef);
      return reply(answer);
    }

    if (intent.kind === "nudge" && trip) {
      const nudged = await sendNudge(admin, trip, "preferences", "individual");
      if ("error" in nudged) return reply(nudged.error);
      return reply(say.nudgedReply(nudged.sentCount, tripName));
    }

    if (intent.kind === "close_decision") {
      return reply(say.closeDecisionSoonReply());
    }
  }

  if (!membership) {
    return reply(say.noTripYetReply());
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
    return reply(say.unsupportedMediaReply());
  }

  if ("error" in result) {
    return reply(`hmm, ${result.error}`);
  }

  if (result.places.length === 0) {
    if (result.alreadyAdded) return reply(say.alreadySavedReply());
    if (result.duplicates.length > 0) return reply(say.alreadyOnMapReply(tripName, result.duplicates));
    if (result.savedLinkOnly) return reply(say.linkSavedNoPlaceReply(tripName));
    return silent();
  }

  return reply(say.placesAddedReply(tripName, result.duplicates, result.farAway));
}

async function organizerFirstName(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string> {
  const { data } = await admin.from("planner_users").select("name").eq("id", userId).maybeSingle();
  return data?.name?.split(" ")[0] || "A friend";
}
