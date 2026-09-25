import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateToken, generateJoinCode } from "./tokens";
import { slugify } from "./slug";
import { findOrCreatePlannerUserByPhone } from "./plannerUser";
import { toE164, isUSPhone } from "./phone";
import { sendSmsText } from "@/lib/twilio/send";

export type PhoneInviteStatus = "sent" | "sent_returning" | "already_member" | "invalid" | "error";

export interface InvitableTrip {
  id: string;
  name: string;
  destination: string | null;
  join_code: string | null;
  twilio_conversation_sid: string | null;
}

/**
 * Invites one phone number to a trip: provisions a bare account if the
 * number is new, writes the per-phone invite row, and sends the text. The
 * organizer's web form (src/app/api/v2/trips/[id]/invites/route.ts) and the
 * "text me their numbers" path in the SMS webhook both go through here, so
 * the invite text and the funnel row can't drift between them.
 *
 * Mutates `trip.join_code` when it has to mint one, so a caller inviting
 * several numbers in a loop doesn't mint a fresh code per number.
 */
export async function invitePhoneToTrip(
  admin: SupabaseClient,
  trip: InvitableTrip,
  organizerName: string,
  rawPhone: string
): Promise<{ phone: string; status: PhoneInviteStatus }> {
  const phone = toE164(rawPhone);
  if (!isUSPhone(phone)) return { phone: rawPhone, status: "invalid" };

  let invitedUser;
  try {
    invitedUser = await findOrCreatePlannerUserByPhone(admin, phone);
  } catch {
    return { phone, status: "error" };
  }

  const { data: existingMembership } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("trip_id", trip.id)
    .eq("user_id", invitedUser.id)
    .eq("status", "active")
    .maybeSingle();
  if (existingMembership) return { phone, status: "already_member" };

  if (!trip.join_code) {
    trip.join_code = generateJoinCode(trip.destination ?? trip.name);
    await admin.from("planner_trips").update({ join_code: trip.join_code }).eq("id", trip.id);
  }

  // A returning user — this number already verified and opted in on an
  // earlier trip — gets a shorter invite that doesn't re-explain texts or
  // re-ask for consent they've already given. What it does NOT do is add
  // them to the trip: the privacy policy says being recognized "isn't the
  // same as being added… you decide whether to join, and your name and
  // other information isn't shared with that trip's members until you
  // accept," and the whole invite flow is built on that one tap being the
  // join. Auto-adding would also unlock the group-text gate on the
  // organizer's page for someone who never answered.
  const returning = invitedUser.notify_sms && Boolean(invitedUser.sms_opted_in_at);

  const token = generateToken();
  const { error: inviteError } = await admin
    .from("planner_trip_invites")
    .upsert(
      {
        trip_id: trip.id,
        phone,
        token,
        created_at: new Date().toISOString(),
        clicked_at: null,
        joined_at: null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "trip_id,phone" }
    );
  if (inviteError) return { phone, status: "error" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const link = `${siteUrl}/j/${slugify(trip.destination ?? trip.name)}/${token}`;
  // Replying "1" is the whole accept — it's one tap in the thread the invite
  // arrived in, and proves the phone. Joining is what opts them in to trip
  // texts, so the message says so in the same breath. The link is the
  // tap-through alternative (src/app/j/[token]) for someone who'd rather
  // see the trip first.
  // The returning version drops the consent ask, not the opt-out line —
  // this still arrives unprompted, about a trip they haven't heard of, so
  // STOP belongs in it.
  const message = returning
    ? `${organizerName} invites you to "${trip.name}" on That Friend. Reply 1 to join, or take a look first: ${link}\nReply STOP to opt out.`
    : `${organizerName} invites you to "${trip.name}" on That Friend. Reply 1 to join — you'll get texts about the trip — or take a look first: ${link}\nReply STOP to opt out.`;
  try {
    await sendSmsText(phone, message);
    return { phone, status: returning ? "sent_returning" : "sent" };
  } catch {
    return { phone, status: "error" };
  }
}

// A US number as people type it: "415 555 0100", "(415) 555-0101",
// "+1 415.555.0102". Anchored on both sides so it can't start or stop
// mid-run — without the lookbehind, "+442079460958" matched its last ten
// digits as a US number and texted a stranger in Chicago.
const US_PHONE_RE = /(?<![\d+])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;

// "+44 207 946 0958" / "+90 532 555 0104": the country code is its own
// digit group, so the lookbehind above doesn't see it — a "+" and a
// non-1 country code right before the match means it's the tail of an
// international number, not a US one.
const INTERNATIONAL_PREFIX_RE = /\+[02-9][\d\s().-]*$/;

/**
 * Pulls US phone numbers out of a text like "sara 415 555 0100, jen
 * (415) 555-0101". Deterministic on purpose — numbers are exact, and this
 * runs before the LLM classifier so a message that's mostly numbers never
 * gets mistaken for a place to save.
 */
export function extractPhoneNumbers(text: string): string[] {
  if (/https?:\/\/|www\./i.test(text)) return [];
  const unique = new Set<string>();
  for (const m of text.matchAll(US_PHONE_RE)) {
    if (INTERNATIONAL_PREFIX_RE.test(text.slice(0, m.index))) continue;
    const digits = m[0].replace(/\D/g, "");
    if (digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))) unique.add(toE164(digits));
  }
  return [...unique];
}

// Words that mark a pasted business listing ("Nopa 560 Divisadero St
// (415) 864-8643") rather than a list of friends — inviting that number
// would text a restaurant.
const ADDRESS_WORDS = /\b(?:st|street|ave|avenue|blvd|boulevard|rd|road|hwy|highway|suite|ste|pkwy)\b/i;

/**
 * True when a text is "here are the numbers" and not much else — a short
 * name per number is fine ("sara 415…, jen 415…"), a paragraph isn't, and
 * neither is anything with a street address in it: leftover multi-digit
 * numbers (a house number, a zip) or street words.
 */
export function looksLikeInviteList(text: string, phones: string[]): boolean {
  if (phones.length === 0) return false;
  const withoutPhones = text.replace(US_PHONE_RE, " ");
  if (/\d{2,}/.test(withoutPhones) || ADDRESS_WORDS.test(withoutPhones)) return false;
  const residual = withoutPhones
    .replace(/[^a-z\s']/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return residual.length <= 3 * phones.length + 3;
}
