import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { generateToken } from "@/lib/planner/tokens";
import { slugify } from "@/lib/planner/slug";
import { sendInviteEmail, sendWithRetry } from "@/lib/planner/email";
import { invitePhoneToTrip, type PhoneInviteStatus } from "@/lib/planner/invitePhone";
import { isActiveMember } from "@/lib/planner/membership";
import { isInvitableEmail } from "@/lib/planner/joinLink";
import { MAX_TRAVELERS_PER_TRIP, MAX_EMAIL_INVITES_PER_TRIP_PER_DAY } from "@/config/limits";

interface InviteRequest {
  email?: string;
  phone?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;

  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  // Active, not just "has a row" — someone who left or was removed keeps
  // their membership row, and mustn't keep sending invites on its behalf.
  if (!(await isActiveMember(admin, tripId, user.id))) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }

  const body: InviteRequest[] = await request.json().catch(() => []);
  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ error: "Provide a list of { email | phone }." }, { status: 400 });
  }
  // Nobody legitimately invites more people in one go than the trip can
  // hold — anything bigger is someone using us to send mail/texts in bulk.
  if (body.length > MAX_TRAVELERS_PER_TRIP) {
    return NextResponse.json(
      { error: `You can invite up to ${MAX_TRAVELERS_PER_TRIP} people at a time.` },
      { status: 400 }
    );
  }

  const { data: trip } = await admin
    .from("planner_trips")
    .select("id, name, destination, join_code, twilio_conversation_sid")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  const organizerName = user.name?.split(" ")[0] || "A friend";

  // Same precedence as before: an entry with an email is treated as an
  // email invite even if it also carries a phone.
  const emailAddresses: string[] = [];
  const phoneEntries: string[] = [];
  const invalidEmails: string[] = [];
  for (const entry of body) {
    if (!entry || typeof entry !== "object") continue;
    const email = typeof entry.email === "string" ? entry.email.trim().toLowerCase() : "";
    if (email) {
      // Checked up front so a bad address is never written or sent — and
      // duplicates in one request only get one email.
      if (!isInvitableEmail(email)) invalidEmails.push(email);
      else if (!emailAddresses.includes(email)) emailAddresses.push(email);
      continue;
    }
    const phone = typeof entry.phone === "string" ? entry.phone.trim() : "";
    if (phone) phoneEntries.push(phone);
  }
  // A typo'd address fails on its own (reported back in emailResults) —
  // rejecting the whole request cancelled every other invite, phones
  // included, and the new-trip form showed nothing.

  // A per-trip daily ceiling on email invites, counted from the rows this
  // route writes — the per-request cap alone doesn't stop the same request
  // being replayed all day. Checked before any send so a request that would
  // cross the line sends nothing rather than half.
  if (emailAddresses.length > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: sentToday } = await admin
      .from("planner_invites")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", tripId)
      .eq("channel", "email")
      .gte("created_at", since);
    if ((sentToday ?? 0) + emailAddresses.length > MAX_EMAIL_INVITES_PER_TRIP_PER_DAY) {
      return NextResponse.json(
        { error: `This trip has hit today's limit of ${MAX_EMAIL_INVITES_PER_TRIP_PER_DAY} email invites. Try again tomorrow, or share the trip link instead.` },
        { status: 429 }
      );
    }
  }

  // The text itself, the invite row and the account provisioning all live
  // in invitePhoneToTrip — shared with the "text me their numbers" path in
  // the SMS webhooks.
  const phoneResults: { phone: string; status: PhoneInviteStatus }[] = [];
  for (const rawPhone of phoneEntries) {
    phoneResults.push(await invitePhoneToTrip(admin, trip, organizerName, rawPhone));
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const slug = slugify(trip.destination ?? trip.name);

  const emailResults: { email: string; status: "sent" | "failed"; error: string | null }[] = invalidEmails.map((email) => ({
    email: email.slice(0, 80),
    status: "failed",
    error: "That doesn't look like an email address.",
  }));
  for (const email of emailAddresses) {
    const token = generateToken();
    const { data: invite, error: insertError } = await admin
      .from("planner_invites")
      .insert({ trip_id: tripId, channel: "email", sent_to: email, token })
      .select("id")
      .single();
    if (insertError || !invite) {
      console.error("[invites] could not create invite row", { email, error: insertError?.message });
      emailResults.push({ email, status: "failed", error: insertError?.message ?? "Could not save the invite." });
      continue;
    }

    const joinUrl = `${siteUrl}/planner/join/${slug}/${token}`;
    const sent = await sendWithRetry(async (attempt) => {
      const result = await sendInviteEmail(email, organizerName, trip.name, joinUrl);
      if (result.ok) {
        console.log("[invites] sent", { inviteId: invite.id, email, attempt });
      } else {
        console.error("[invites] send failed", { inviteId: invite.id, email, attempt, kind: result.error.kind, error: result.error.message });
      }
      return result;
    });
    await admin
      .from("planner_invites")
      .update({ status: sent.status, sent_at: sent.status === "sent" ? new Date().toISOString() : null, error: sent.error })
      .eq("id", invite.id);
    emailResults.push({ email, status: sent.status, error: sent.error });
  }

  return NextResponse.json({ emailResults, phoneResults }, { status: 201 });
}
