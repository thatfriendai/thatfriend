import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionForPhone } from "@/lib/planner/phoneSession";
import { addParticipantToConversation } from "@/lib/twilio/conversations";
import { toE164, isUSPhone } from "@/lib/planner/phone";
import { getPlannerUser } from "@/lib/planner/session";
import { mergePlannerUsers } from "@/lib/planner/plannerUser";
import { autoFriendTripMembers } from "@/lib/planner/follows";
import { sendSmsText } from "@/lib/twilio/send";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  const phone = rawPhone ? toE164(rawPhone) : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!phone || !code) {
    return NextResponse.json({ error: "Phone and code are required." }, { status: 400 });
  }
  if (!isUSPhone(phone)) {
    return NextResponse.json(
      { error: "That Friend can only text US phone numbers right now." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: codeRow } = await admin
    .from("planner_whatsapp_codes")
    .select("*")
    .eq("phone", phone)
    .eq("code", code)
    .maybeSingle();

  if (!codeRow || new Date(codeRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "That code is wrong or has expired." }, { status: 400 });
  }

  await admin.from("planner_whatsapp_codes").delete().eq("id", codeRow.id);

  // Already signed in (e.g. linking a phone from the profile page) —
  // attach this phone to the current account instead of creating a
  // second, disconnected one and swapping out the active session.
  const currentUser = await getPlannerUser();
  if (currentUser) {
    const { data: staleAccount } = await admin
      .from("planner_users")
      .select("id, auth_user_id")
      .eq("phone", phone)
      .maybeSingle();

    if (staleAccount && staleAccount.id !== currentUser.id) {
      await mergePlannerUsers(admin, staleAccount.id, currentUser.id, staleAccount.auth_user_id);
    }

    await admin
      .from("planner_users")
      .update({ phone })
      .eq("id", currentUser.id);

    // Linking a phone after already being on a trip whose group text
    // exists — sweep into every one of them, same as joining fresh does.
    const { data: memberships } = await admin
      .from("planner_memberships")
      .select("planner_trips(twilio_conversation_sid)")
      .eq("user_id", currentUser.id);
    const conversationSids = (memberships ?? [])
      .map((m) => (m.planner_trips as unknown as { twilio_conversation_sid: string | null } | null)?.twilio_conversation_sid)
      .filter((sid): sid is string => Boolean(sid));
    await Promise.all(
      conversationSids.map((sid) =>
        addParticipantToConversation(sid, phone).catch(() => {
          // Best-effort — they can still be synced into the group thread later.
        })
      )
    );

    return NextResponse.json({ ok: true });
  }

  const { data: existing } = await admin
    .from("planner_users")
    .select("id, name, username, sms_opted_in_at")
    .eq("phone", phone)
    .maybeSingle();

  let plannerUserId: string;
  let needsProfile: boolean;
  let neverTextedIn = true;
  if (existing) {
    plannerUserId = existing.id;
    needsProfile = !existing.username;
    neverTextedIn = !existing.sms_opted_in_at;
    if (codeRow.name && !existing.name) {
      await admin.from("planner_users").update({ name: codeRow.name }).eq("id", existing.id);
    }
  } else {
    const { data: created, error: createError } = await admin
      .from("planner_users")
      .insert({ phone, name: codeRow.name })
      .select("id")
      .single();
    if (createError || !created) {
      return NextResponse.json(
        { error: createError?.message ?? "Could not create your account." },
        { status: 500 }
      );
    }
    plannerUserId = created.id;
    needsProfile = true;
  }

  const session = await createSessionForPhone(admin, phone);
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: 500 });
  }

  if (codeRow.invite_token) {
    const { data: invite } = await admin
      .from("planner_invites")
      .select("id, trip_id")
      .eq("token", codeRow.invite_token)
      .maybeSingle();

    if (invite) {
      await admin
        .from("planner_memberships")
        .upsert(
          { trip_id: invite.trip_id, user_id: plannerUserId, role: "member" },
          { onConflict: "trip_id,user_id", ignoreDuplicates: true }
        );
      await admin.from("planner_invites").update({ accepted_by: plannerUserId }).eq("id", invite.id);
      await autoFriendTripMembers(admin, invite.trip_id, plannerUserId);

      const { data: invitedTrip } = await admin
        .from("planner_trips")
        .select("twilio_conversation_sid")
        .eq("id", invite.trip_id)
        .maybeSingle();
      if (invitedTrip?.twilio_conversation_sid) {
        await addParticipantToConversation(invitedTrip.twilio_conversation_sid, phone).catch(
          () => {
            // Best-effort — they can still be synced into the group thread later.
          }
        );
      }

      // This web accept flow doesn't itself go through the organizer
      // invite-SMS (that only fires from the per-phone invite endpoint) —
      // if this is the first time we've ever had a way to text this
      // number, that ask has to happen here instead of waiting for a
      // notify.ts/nudge.ts event to get there first by coincidence.
      if (neverTextedIn) {
        await sendSmsText(
          phone,
          "Reply JOIN to get trip updates from That Friend. Reply STOP anytime to opt out."
        ).catch(() => {
          // Best-effort — they're a real member either way.
        });
      }

      return NextResponse.json({ redirect: `/planner/trips/${invite.trip_id}/preferences` });
    }
  }

  return NextResponse.json({ redirect: needsProfile ? "/planner/profile?welcome=1" : "/planner/home" });
}
