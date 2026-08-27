import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const token = typeof body.token === "string" ? body.token : "";

  if (phone && !email) {
    // Spec: "Phone sign-in can send codes over WhatsApp" — that's the
    // Phase 6 WhatsApp integration. Nothing to send yet.
    return NextResponse.json(
      { error: "Phone sign-in isn't available yet — use email for now." },
      { status: 501 }
    );
  }

  if (!email) {
    return NextResponse.json({ error: "Provide an email." }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const redirectTo = token
    ? `${siteUrl}/api/v2/auth/callback?token=${encodeURIComponent(token)}`
    : `${siteUrl}/api/v2/auth/callback`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ sent: true });
}
