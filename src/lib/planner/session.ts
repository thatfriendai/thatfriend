import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlannerUser } from "@/lib/supabase/planner-types";

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

  if (existing) return existing;

  // First sign-in through this Supabase Auth account — link (or create) the
  // planner_users row. A row may already exist for this email from an
  // invite that hasn't been claimed yet (created with no auth_user_id).
  const { data: byEmail } = await admin
    .from("planner_users")
    .select("*")
    .eq("email", authUser.email)
    .maybeSingle<PlannerUser>();

  if (byEmail) {
    const { data: linked } = await admin
      .from("planner_users")
      .update({ auth_user_id: authUser.id })
      .eq("id", byEmail.id)
      .select("*")
      .single<PlannerUser>();
    return linked ?? byEmail;
  }

  const { data: created, error } = await admin
    .from("planner_users")
    .insert({ email: authUser.email, auth_user_id: authUser.id })
    .select("*")
    .single<PlannerUser>();

  if (error || !created) return null;
  return created;
}
