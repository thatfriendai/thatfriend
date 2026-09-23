import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergePlannerUsers } from "@/lib/planner/plannerUser";

/**
 * Binds a pending email link to the browser that asked for it. Without
 * this, a pending planner_email_links row was completed by whoever next
 * signed in with that email from anywhere — so an attacker could "add"
 * someone else's email to their own phone-only account and wait for the
 * victim's next ordinary sign-in to fold the victim's account into theirs.
 * The requesting browser now carries an httpOnly cookie naming the
 * requesting account, and completePendingEmailLink only acts when that
 * cookie matches the pending row. No schema change needed: the cookie
 * itself is the proof of "same browser" (only our server can set it, and
 * only in response to the requester's own signed-in POST), and the magic
 * link already has to be opened in that same browser anyway — Supabase's
 * PKCE code exchange fails anywhere else — so the legitimate flow loses
 * nothing. Same 30-minute lifetime as the pending row itself.
 */
export const EMAIL_LINK_COOKIE = "tf_email_link";
export const EMAIL_LINK_TTL_MS = 30 * 60 * 1000;

export function emailLinkCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: EMAIL_LINK_TTL_MS / 1000,
  };
}

/**
 * Completes a pending "add an email to a phone-only account" request (see
 * planner_email_links and /api/v2/users/me/email) — the magic-link click
 * that just landed here proved ownership of `email`, but exchanging its
 * code signed this browser in as a throwaway auth identity for that email,
 * not the phone account that actually requested the link. Folds that
 * throwaway identity into the requesting account and re-establishes a
 * session for it in this browser. Returns null (does nothing) when this
 * callback isn't for a pending email link — the caller's normal magic-link/
 * OAuth flow should then proceed untouched.
 */
export async function completePendingEmailLink(
  request: Request,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Response | null> {
  const { origin } = new URL(request.url);
  const admin = createAdminClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.email) return null;

  // No cookie means this browser never asked to add an email — whatever
  // pending row exists for this address belongs to someone else's request
  // and must not touch this sign-in (see EMAIL_LINK_COOKIE above).
  const cookieStore = await cookies();
  const requesterId = cookieStore.get(EMAIL_LINK_COOKIE)?.value;
  if (!requesterId) return null;

  const { data: link } = await admin
    .from("planner_email_links")
    .select("requesting_planner_user_id, expires_at")
    .eq("email", authUser.email)
    .maybeSingle();
  if (!link || link.requesting_planner_user_id !== requesterId) return null;

  await admin.from("planner_email_links").delete().eq("email", authUser.email);
  cookieStore.delete(EMAIL_LINK_COOKIE);
  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.redirect(`${origin}/planner/profile?error=That link expired — try again.`);
  }

  const { data: requestingUser } = await admin
    .from("planner_users")
    .select("id, auth_user_id")
    .eq("id", link.requesting_planner_user_id)
    .maybeSingle();
  if (!requestingUser?.auth_user_id) {
    return NextResponse.redirect(`${origin}/planner/profile?error=Could not confirm that email.`);
  }

  // getPlannerUser() hasn't run yet in this request, but this throwaway
  // auth identity may already have a planner_users row from an earlier
  // click of the same (still-valid) link — fold it in rather than leaving
  // an orphaned duplicate. mergePlannerUsers also deletes the throwaway
  // auth user for us.
  const { data: staleAccount } = await admin
    .from("planner_users")
    .select("id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (staleAccount && staleAccount.id !== requestingUser.id) {
    await mergePlannerUsers(admin, staleAccount.id, requestingUser.id, authUser.id);
  } else {
    await admin.auth.admin.deleteUser(authUser.id).catch(() => {
      // Best-effort — a leftover unused auth user is harmless if this fails.
    });
  }

  await admin.auth.admin.updateUserById(requestingUser.auth_user_id, {
    email: authUser.email,
    email_confirm: true,
  });
  await admin.from("planner_users").update({ email: authUser.email }).eq("id", requestingUser.id);

  // The session this browser just got is for the now-deleted throwaway
  // auth user — re-establish one for the real account before redirecting,
  // the same silent bootstrap createSessionForPhone uses.
  const { data: linkData, error: linkGenError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.email,
  });
  if (linkGenError || !linkData.properties?.hashed_token) {
    return NextResponse.redirect(`${origin}/planner/profile?error=Email confirmed, but couldn't sign you back in.`);
  }
  await supabase.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: "magiclink" });

  return NextResponse.redirect(`${origin}/planner/profile?emailAdded=1`);
}
