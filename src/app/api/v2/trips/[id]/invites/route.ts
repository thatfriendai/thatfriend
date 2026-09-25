import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { generateToken } from "@/lib/planner/tokens";
import { slugify } from "@/lib/planner/slug";
import { sendInviteEmail, sendWithRetry } from "@/lib/planner/email";
import { invitePhoneToTrip, type PhoneInviteStatus } from "@/lib/planner/invitePhone";

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
    .select("id, name, destination, join_code, twilio_conversation_sid")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  const organizerName = user.name?.split(" ")[0] || "A friend";

  // Same precedence as before: an entry with an email is treated as an
  // email invite even if it also carries a phone.
  const emailAddresses: string[] = [];
  const phoneEntries: string[] = [];
  for (const entry of body) {
    const email = entry.email?.trim().toLowerCase();
    if (email) {
      emailAddresses.push(email);
      continue;
    }
    const phone = entry.phone?.trim();
    if (phone) phoneEntries.push(phone);
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

  const emailResults: { email: string; status: "sent" | "failed"; error: string | null }[] = [];
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
