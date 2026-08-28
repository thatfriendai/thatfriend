import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/meta/client";
import { normalizePhoneDigits } from "@/lib/planner/phone";

const CODE_TTL_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const token = typeof body.token === "string" ? body.token : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const waOptIn = body.whatsapp_opt_in === true;

  if (phone && !email) {
    const admin = createAdminClient();
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
      await sendWhatsAppText(
        normalizePhoneDigits(phone),
        `Your That Friend sign-in code is ${code}. It expires in 10 minutes.`
      );
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not send the WhatsApp code." },
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
