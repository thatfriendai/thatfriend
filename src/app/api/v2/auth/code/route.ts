import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSmsText } from "@/lib/twilio/send";
import { toE164, isUSPhone } from "@/lib/planner/phone";
import { safeNextPath } from "@/lib/planner/session";

const CODE_TTL_MS = 10 * 60 * 1000;
// One text per number per minute. Each send is a real SMS we pay for and
// a stranger's phone buzzing — without this, anyone could loop this
// endpoint at someone's number. Also resets verify-phone's wrong-guess
// counter, so it paces how fast fresh guesses can be bought, too.
const RESEND_COOLDOWN_MS = 60 * 1000;

async function phoneForInviteToken(token: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("planner_trip_invites")
    .select("phone, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  return data.phone;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  const token = typeof body.token === "string" ? body.token : "";
  // A per-phone invite link (src/app/j/[token]) sends only its token — the
  // number it was texted to is looked up here rather than put in the page.
  const phone = rawPhone ? toE164(rawPhone) : token && !email ? ((await phoneForInviteToken(token)) ?? "") : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const waOptIn = body.whatsapp_opt_in === true;
  // Where the magic link should land after sign-in (the page that bounced
  // them to /planner/login). Re-validated by the callback too.
  const next = safeNextPath(typeof body.next === "string" ? body.next : null);

  if (!phone && !email && token) {
    return NextResponse.json({ error: "That invite isn't valid anymore." }, { status: 404 });
  }

  if (phone && !email) {
    if (!isUSPhone(phone)) {
      return NextResponse.json(
        { error: "That Friend can only text US phone numbers right now." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: recent } = await admin
      .from("planner_whatsapp_codes")
      .select("created_at")
      .eq("phone", phone)
      .gt("created_at", new Date(Date.now() - RESEND_COOLDOWN_MS).toISOString())
      .limit(1)
      .maybeSingle();
    // A code went out under a minute ago — don't send another, but answer
    // like a send so the page moves on to the code box. The usual way here
    // is a slow SMS, a client timeout or a reload, and the code is already
    // on their phone; a 429 left them stuck on "send code" with nowhere to
    // type it.
    if (recent) {
      return NextResponse.json({ sent: true, cooldown: true });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    await admin.from("planner_whatsapp_codes").delete().eq("phone", phone);
    const { error: insertError } = await admin.from("planner_whatsapp_codes").insert({
      phone,
      code,
      name: name || null,
      invite_token: token || null,
      expires_at: expiresAt,
    });
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    try {
      await sendSmsText(phone, `Your That Friend sign-in code is ${code}. It expires in 10 minutes.`);
    } catch (e) {
      // Nothing was delivered, so don't hold them to the resend cooldown.
      await admin.from("planner_whatsapp_codes").delete().eq("phone", phone).eq("code", code);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not send the sign-in code." },
        { status: 502 }
      );
    }

    return NextResponse.json({ sent: true });
  }

  if (!email) {
    return NextResponse.json({ error: "Provide an email." }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (name) params.set("name", name);
  if (waOptIn) params.set("wa", "1");
  if (next) params.set("next", next);
  const query = params.toString();
  const redirectTo = `${siteUrl}/api/v2/auth/callback${query ? `?${query}` : ""}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ sent: true });
}
