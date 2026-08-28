import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function syntheticEmailFor(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return `phone-${digits}@phone.thatfriend.internal`;
}

/**
 * Establishes a real, cookied Supabase session for a phone number we've
 * already verified out-of-band (a WhatsApp code the user typed back in) —
 * no Supabase phone provider configured, so we can't use signInWithOtp/
 * verifyOtp for phone directly. Instead: ensure an auth.users row exists
 * for this phone (keyed by a synthetic, never-shown email so it can use
 * the normal email-based magic-link machinery), admin-generate a magic
 * link for it, and immediately redeem the token server-side. Redeeming via
 * the request-bound server client (not the admin client) is what makes
 * Supabase's SDK write the session cookie correctly through Next's
 * response — the same mechanism a real magic-link click uses, just
 * without a browser round-trip.
 */
export async function createSessionForPhone(
  admin: SupabaseClient,
  phone: string
): Promise<{ authUserId: string } | { error: string }> {
  const email = syntheticEmailFor(phone);

  const { data: plannerUser } = await admin
    .from("planner_users")
    .select("id, auth_user_id")
    .eq("phone", phone)
    .maybeSingle();

  let authUserId = plannerUser?.auth_user_id ?? null;

  if (!authUserId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { phone },
    });
    if (createError || !created.user) {
      return { error: createError?.message ?? "Could not create an account for that number." };
    }
    authUserId = created.user.id;

    if (plannerUser) {
      await admin.from("planner_users").update({ auth_user_id: authUserId }).eq("id", plannerUser.id);
    }
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    return { error: linkError?.message ?? "Could not start a session." };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) {
    return { error: verifyError.message };
  }

  return { authUserId };
}
