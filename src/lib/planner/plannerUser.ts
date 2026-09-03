import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhoneDigits } from "./phone";

/** Finds a planner_users row whose phone matches, comparing digits-only (ignores +/formatting differences). */
export async function findPlannerUserByPhone(admin: SupabaseClient, fromDigits: string) {
  const { data: candidates } = await admin
    .from("planner_users")
    .select("id, phone")
    .not("phone", "is", null);

  return (candidates ?? []).find((c) => normalizePhoneDigits(c.phone as string) === fromDigits) ?? null;
}
