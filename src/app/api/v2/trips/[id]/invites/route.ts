import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { generateToken, generateJoinCode } from "@/lib/planner/tokens";
import { findOrCreatePlannerUserByPhone } from "@/lib/planner/plannerUser";
import { toE164, isUSPhone } from "@/lib/planner/phone";
import { sendSmsText } from "@/lib/twilio/send";
import { addParticipantToConversation } from "@/lib/twilio/conversations";
import { logConsentCarryover } from "@/lib/planner/consent";

interface InviteRequest {
  email?: string;
  phone?: string;
}

type PhoneInviteStatus = "sent" | "carried_over" | "already_member" | "invalid" | "error";

// Off until the privacy policy has a line covering "if you've texted That
// Friend before, we may add your number to other trips your contacts
// invite you to without asking again" — see the handoff doc.
const CONTACT_MATCH_ENABLED = process.env.ENABLE_CONTACT_MATCH_INVITES === "true";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;

  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }

  const body: InviteRequest[] = await request.json().catch(() => []);
  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ error: "Provide a list of { email | phone }." }, { status: 400 });
  }

  const { data: trip } = await admin
    .from("planner_trips")
    .select("name, destination, join_code, twilio_conversation_sid")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  let joinCode = trip.join_code;
  const organizerName = user.name?.split(" ")[0] || "A friend";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Same precedence as before: an entry with an email is treated as an
  // email invite even if it also carries a phone.
  const emailRows: { trip_id: string; channel: "email"; sent_to: string; token: string }[] = [];
  const phoneEntries: string[] = [];
  for (const entry of body) {
    const email = entry.email?.trim().toLowerCase();
    if (email) {
      emailRows.push({ trip_id: tripId, channel: "email", sent_to: email, token: generateToken() });
      continue;
    }
    const phone = entry.phone?.trim();
    if (phone) phoneEntries.push(phone);
  }

  const phoneResults: { phone: string; status: PhoneInviteStatus }[] = [];

  for (const rawPhone of phoneEntries) {
    const phone = toE164(rawPhone);
    if (!isUSPhone(phone)) {
      phoneResults.push({ phone: rawPhone, status: "invalid" });
      continue;
    }

    let invitedUser;
    try {
      invitedUser = await findOrCreatePlannerUserByPhone(admin, phone);
    } catch {
      phoneResults.push({ phone, status: "error" });
      continue;
    }

    const { data: existingMembership } = await admin
      .from("planner_memberships")
      .select("trip_id")
      .eq("trip_id", tripId)
      .eq("user_id", invitedUser.id)
      .maybeSingle();
    if (existingMembership) {
      phoneResults.push({ phone, status: "already_member" });
      continue;
    }

    if (!joinCode) {
      joinCode = generateJoinCode(trip.destination ?? trip.name);
      await admin.from("planner_trips").update({ join_code: joinCode }).eq("id", tripId);
    }

    // Returning-user contact-match: this number already opted in on a prior
    // trip, so skip the join-text/link step entirely and add them straight
    // in, with one informational (not consent-seeking) text.
    if (CONTACT_MATCH_ENABLED && invitedUser.notify_sms) {
      const { error: memberError } = await admin
        .from("planner_memberships")
        .insert({ trip_id: tripId, user_id: invitedUser.id, role: "member" });
      if (memberError) {
        phoneResults.push({ phone, status: "error" });
        continue;
      }

      if (trip.twilio_conversation_sid) {
        await addParticipantToConversation(trip.twilio_conversation_sid, phone).catch(() => {
          // Best-effort — group-text sync can catch up later.
        });
      }

      await admin
        .from("planner_trip_invites")
        .upsert(
          { trip_id: tripId, phone, token: generateToken(), joined_at: new Date().toISOString() },
          { onConflict: "trip_id,phone" }
        );

      await logConsentCarryover(admin, phone, invitedUser.sms_opted_in_at, tripId);

      try {
        await sendSmsText(
          phone,
          `${organizerName} added you to "${trip.name}" on That Friend. Reply STOP anytime to opt out.`
        );
      } catch {
        // Best-effort — they're a real member either way.
      }

      phoneResults.push({ phone, status: "carried_over" });
      continue;
    }

    const token = generateToken();
    const { error: inviteError } = await admin
      .from("planner_trip_invites")
      .upsert(
        {
          trip_id: tripId,
          phone,
          token,
          created_at: new Date().toISOString(),
          clicked_at: null,
          joined_at: null,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "trip_id,phone" }
      );
    if (inviteError) {
      phoneResults.push({ phone, status: "error" });
      continue;
    }

    const link = `${siteUrl}/j/${token}`;
    // Leads with the reply, not the link — replying "1" or "START" is the
    // lowest-friction accept (resolved via this invite's phone, handled in
    // src/app/api/v2/twilio/route.ts). The link stays as the tap-through
    // alternative, and JOIN <code> below still works for a forwarded
    // screenshot, where the reply-based path can't resolve to anyone.
    const message = `${organizerName} invites you to "${trip.name}" on That Friend. Reply START (or just 1) to get updates and text with us — or tap: ${link}\nOr reply JOIN ${joinCode}. Reply STOP to opt out.`;
    try {
      await sendSmsText(phone, message);
      phoneResults.push({ phone, status: "sent" });
    } catch {
      phoneResults.push({ phone, status: "error" });
    }
  }

  const { data: invites, error } =
    emailRows.length > 0
      ? await admin.from("planner_invites").insert(emailRows).select("*")
      : { data: [], error: null };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invites, phoneResults, delivered: true }, { status: 201 });
}
