import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

const LINK_TTL_MS = 30 * 60 * 1000;

/**
 * Starts adding a first real email to a phone-only account. Not the same
 * path as changing an existing real email (EmailChangePanel still uses
 * Supabase's own self-service updateUser() for that, unchanged) — a
 * phone-only account's auth identity carries a synthetic, unreachable
 * placeholder email, and Supabase's secure email change tries to confirm
 * both the old and new address, which always fails on that placeholder.
 * See the planner_email_links table comment and /api/v2/auth/callback for
 * how the resulting magic-link click gets folded into this account.
 */
export async function POST(request: Request) {
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.email) {
    return NextResponse.json({ error: "This account already has an email — use the change form instead." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: linkError } = await admin.from("planner_email_links").upsert({
    email,
    requesting_planner_user_id: user.id,
    expires_at: new Date(Date.now() + LINK_TTL_MS).toISOString(),
  });
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/api/v2/auth/callback`, shouldCreateUser: true },
  });

  if (error) {
    await admin.from("planner_email_links").delete().eq("email", email);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ sent: true });
}
