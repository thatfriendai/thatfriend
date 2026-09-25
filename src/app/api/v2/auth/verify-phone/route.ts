import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionForPhone } from "@/lib/planner/phoneSession";
import { addParticipantToConversation } from "@/lib/twilio/conversations";
import { toE164, isUSPhone } from "@/lib/planner/phone";
import { afterSignInPath, getPlannerUser, safeNextPath } from "@/lib/planner/session";
import { mergePlannerUsers } from "@/lib/planner/plannerUser";
import { acceptInviteToken } from "@/lib/planner/joinLink";

/** Wrong guesses allowed against one code before it's thrown away — 5 in a million is no real brute-force budget. */
const MAX_CODE_ATTEMPTS = 5;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const inviteToken = typeof body.token === "string" ? body.token : "";
  // Only the profile page's "Add a phone number" (PhoneLinkPanel) sends
  // this. Anywhere else — the login page opened while some other account
  // is still signed in, a shared device — verifying a number means "sign
  // me in as this number," and silently merging that number's whole
  // account into whoever happened to be signed in would be both surprising
  // and a way to absorb someone else's trips.
  const linkToCurrentAccount = body.link === true;
  const next = safeNextPath(typeof body.next === "string" ? body.next : null);

  const admin = createAdminClient();

  // The per-phone invite page (src/app/j/[token]) sends its token instead
  // of the number — the code row for that number carries the token, so
  // token identifies it just as well as the phone does. Resolved without
  // the code, so a wrong guess still counts against that code's attempts
  // below instead of just reading as "no such row."
  let phone = rawPhone ? toE164(rawPhone) : "";
  if (!phone && inviteToken && code) {
    const { data: tokenRow } = await admin
      .from("planner_whatsapp_codes")
      .select("phone")
      .eq("invite_token", inviteToken)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    phone = tokenRow?.phone ?? "";
  }

  if (!phone || !code) {
    return NextResponse.json({ error: "Phone and code are required." }, { status: 400 });
  }
  if (!isUSPhone(phone)) {
    return NextResponse.json(
      { error: "That Friend can only text US phone numbers right now." },
      { status: 400 }
    );
  }

  const currentUser = await getPlannerUser();
  if (linkToCurrentAccount && !currentUser) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // auth/code keeps one live code per phone. Looked up by phone alone (not
  // phone + code) so a wrong guess can be counted against it.
  const { data: codeRow } = await admin
    .from("planner_whatsapp_codes")
    .select("*")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!codeRow || new Date(codeRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "That code is wrong or has expired." }, { status: 400 });
  }

  // `attempts` comes from supabase/migrations/2026-09-23-qa-hardening.sql.
  // Every guess — right or wrong — is counted BEFORE the code is compared,
  // with a compare-and-set on the old count, so a burst of parallel guesses
  // can't all read attempts = 0 and each get a free try: only one request
  // per count value wins, the rest are turned away without being checked.
  if (typeof codeRow.attempts === "number") {
    const attempts = codeRow.attempts + 1;
    if (attempts > MAX_CODE_ATTEMPTS) {
      await admin.from("planner_whatsapp_codes").delete().eq("id", codeRow.id);
      return NextResponse.json(
        { error: "Too many wrong tries — ask for a new code and try again." },
        { status: 429 }
      );
    }
    const { data: counted } = await admin
      .from("planner_whatsapp_codes")
      .update({ attempts })
      .eq("id", codeRow.id)
      .eq("attempts", codeRow.attempts)
      .select("id");
    if (!counted || counted.length === 0) {
      return NextResponse.json({ error: "One moment — try that code again." }, { status: 429 });
    }
    if (codeRow.code !== code) {
      if (attempts >= MAX_CODE_ATTEMPTS) {
        await admin.from("planner_whatsapp_codes").delete().eq("id", codeRow.id);
        return NextResponse.json(
          { error: "Too many wrong tries — ask for a new code and try again." },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "That code is wrong or has expired." }, { status: 400 });
    }
  } else if (codeRow.code !== code) {
    // Migration not run yet, so there's no column to count in — fail
    // closed: one wrong guess burns the code (the person just asks for a
    // new one) rather than leaving a 6-digit code open to unlimited guesses.
    await admin.from("planner_whatsapp_codes").delete().eq("id", codeRow.id);
    return NextResponse.json(
      { error: "That code didn't match — ask for a new code and try again." },
      { status: 400 }
    );
  }

  await admin.from("planner_whatsapp_codes").delete().eq("id", codeRow.id);

  // Explicitly linking a phone from the profile page — attach it to the
  // current account instead of creating a second, disconnected one and
  // swapping out the active session. Without `link`, fall through to the
  // plain sign-in below, which replaces whatever session this browser had
  // with the phone's own account.
  if (linkToCurrentAccount && currentUser) {
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
      .eq("user_id", currentUser.id)
      // Not trips they've left or been removed from.
      .eq("status", "active");
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
    .select("id, name, username")
    .eq("phone", phone)
    .maybeSingle();

  let plannerUserId: string;
  let needsProfile: boolean;
  if (existing) {
    plannerUserId = existing.id;
    // Only a genuinely bare account (nothing but a phone — e.g. provisioned
    // by an organizer's invite) gets the welcome/profile setup. Someone who
    // already has a name is an existing user, username or not, and goes to
    // the main page like anyone signing back in.
    needsProfile = !existing.username && !existing.name;
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
    // The tap on "Join <trip>" that brought them here was the consent
    // (src/lib/planner/joinLink.ts) — acceptInviteToken records it against
    // this now-verified phone. No "reply JOIN" text afterwards.
    const { data: joiningUser } = await admin
      .from("planner_users")
      .select("id, phone, notify_sms, sms_opted_in_at")
      .eq("id", plannerUserId)
      .maybeSingle();
    if (joiningUser) {
      const accepted = await acceptInviteToken(admin, joiningUser, codeRow.invite_token);
      if (accepted.outcome === "joined" || accepted.outcome === "already_member") {
        return NextResponse.json({ redirect: `/planner/trips/${accepted.tripId}` });
      }
    }
  }

  return NextResponse.json({ redirect: afterSignInPath(needsProfile, next) });
}
