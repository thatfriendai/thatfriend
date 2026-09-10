import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergePlannerUsers } from "@/lib/planner/plannerUser";

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

  const { data: link } = await admin
    .from("planner_email_links")
    .select("requesting_planner_user_id, expires_at")
    .eq("email", authUser.email)
    .maybeSingle();
  if (!link) return null;

  await admin.from("planner_email_links").delete().eq("email", authUser.email);
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
