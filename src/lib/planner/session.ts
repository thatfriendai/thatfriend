import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlannerUser } from "@/lib/supabase/planner-types";
import { isSyntheticPhoneEmail } from "@/lib/planner/phoneSession";

/**
 * A post-sign-in destination taken from a `next` query param, or null if
 * it isn't safe to redirect to. Only same-origin absolute paths pass:
 * "//evil.com" and "/\\evil.com" are protocol-relative URLs to a browser
 * (it treats a backslash like a slash), so both — and anything with a
 * scheme, or control characters a browser might strip — are rejected.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!/^\/(?!\/)/.test(next)) return null;
  if (next.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(next)) return null;
  return next;
}

/**
 * Where to send someone who just signed in. A brand-new account goes to
 * profile setup first, carrying `next` along so setup can finish the trip
 * they started — a homepage "Start planning" tap used to end on the
 * profile page and never reach the new-trip form.
 */
export function afterSignInPath(needsProfile: boolean, next: string | null): string {
  if (needsProfile) return next ? `/planner/profile?welcome=1&next=${encodeURIComponent(next)}` : "/planner/profile?welcome=1";
  return next ?? "/planner/home";
}

/**
 * Resolves the signed-in Supabase Auth user (email magic-link) to their
 * planner_users row, creating one on first sign-in. Returns null if nobody
 * is signed in. Phone-identified planner_users never come back from this —
 * they have no Supabase Auth session until Phase 6 (WhatsApp sign-in).
 */
export async function getPlannerUser(): Promise<PlannerUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) return null;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("planner_users")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .maybeSingle<PlannerUser>();

  if (existing) {
    // Supabase is the source of truth for the address: a confirmed email
    // change (EmailChangePanel) updates auth.users but not this row. Left
    // stale, the OLD address would still match the byEmail lookup below —
    // whoever signed in with it next would be handed this account. Skip
    // the synthetic placeholder phone-only identities carry. Best-effort:
    // a unique clash (another row already holds the address) leaves the
    // row as-is rather than failing the request.
    if (existing.email !== authUser.email && !isSyntheticPhoneEmail(authUser.email)) {
      const { data: synced, error: syncError } = await admin
        .from("planner_users")
        .update({ email: authUser.email })
        .eq("id", existing.id)
        .select("*")
        .single<PlannerUser>();
      if (!syncError && synced) return synced;
    }
    return existing;
  }

  // First sign-in through this Supabase Auth account — link (or create) the
  // planner_users row. A row may already exist for this email from an
  // invite that hasn't been claimed yet (created with no auth_user_id).
  const { data: byEmail } = await admin
    .from("planner_users")
    .select("*")
    .eq("email", authUser.email)
    .maybeSingle<PlannerUser>();

  if (byEmail?.auth_user_id) {
    // Already claimed by a DIFFERENT auth identity (the same one would have
    // matched above) — typically an address its owner has since changed
    // away from, before the sync above caught up. Re-pointing the row here
    // would hand that account to whoever holds the old address, and a
    // fresh row can't be created either (email is unique), so treat this
    // sign-in as unresolvable rather than hijack it.
    return null;
  }

  if (byEmail) {
    const { data: linked } = await admin
      .from("planner_users")
      .update({ auth_user_id: authUser.id })
      .eq("id", byEmail.id)
      .select("*")
      .single<PlannerUser>();
    return linked ?? byEmail;
  }

  const oauthName =
    typeof authUser.user_metadata?.full_name === "string"
      ? authUser.user_metadata.full_name
      : typeof authUser.user_metadata?.name === "string"
        ? authUser.user_metadata.name
        : null;

  const { data: created, error } = await admin
    .from("planner_users")
    .insert({ email: authUser.email, auth_user_id: authUser.id, name: oauthName })
    .select("*")
    .single<PlannerUser>();

  if (error || !created) return null;
  return created;
}
