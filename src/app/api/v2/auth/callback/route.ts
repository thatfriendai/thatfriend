import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { completePendingEmailLink } from "@/lib/planner/emailLink";
import { acceptInviteToken } from "@/lib/planner/joinLink";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token = searchParams.get("token");
  const name = searchParams.get("name");
  const waOptIn = searchParams.get("wa") === "1";

  if (!code) {
    return NextResponse.redirect(`${origin}/planner/login?error=Could not sign in`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/planner/login?error=Could not sign in`);
  }

  const emailLinkResponse = await completePendingEmailLink(request, supabase);
  if (emailLinkResponse) return emailLinkResponse;

  const plannerUser = await getPlannerUser();
  if (!plannerUser) {
    return NextResponse.redirect(`${origin}/planner/login?error=Could not sign in`);
  }

  const admin = createAdminClient();

  if ((name && !plannerUser.name) || waOptIn) {
    await admin
      .from("planner_users")
      .update({
        ...(name && !plannerUser.name ? { name } : {}),
        ...(waOptIn ? { whatsapp_opt_in: true } : {}),
      })
      .eq("id", plannerUser.id);
  }

  if (token) {
    // Same one tap as the phone path (src/app/api/v2/auth/verify-phone):
    // the join page's button was the consent, acceptInviteToken records it
    // if this account has a phone, and there's no follow-up "reply JOIN".
    const accepted = await acceptInviteToken(admin, plannerUser, token);
    if (accepted.outcome === "joined" || accepted.outcome === "already_member") {
      return NextResponse.redirect(`${origin}/planner/trips/${accepted.tripId}`);
    }
  }

  return NextResponse.redirect(
    `${origin}${plannerUser.username ? "/planner/home" : "/planner/profile?welcome=1"}`
  );
}
