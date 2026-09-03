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

/** Tables where a planner_users.id shows up as a plain "owner" column — no uniqueness constraint, so reassigning can't collide. */
const OWNER_COLUMNS: { table: string; column: string }[] = [
  { table: "planner_trips", column: "created_by" },
  { table: "planner_trips", column: "dates_flagged_by" },
  { table: "planner_invites", column: "accepted_by" },
  { table: "planner_itinerary_items", column: "created_by" },
  { table: "planner_places", column: "added_by" },
  { table: "planner_resources", column: "added_by" },
  { table: "planner_decisions", column: "created_by" },
  { table: "planner_decision_notes", column: "created_by" },
];

/** Tables keyed on (user_id + these extra columns) — reassigning a stale row can collide with a row the kept account already has. */
const COMPOSITE_MEMBERSHIP_TABLES: { table: string; keyCols: string[] }[] = [
  { table: "planner_memberships", keyCols: ["trip_id"] },
  { table: "planner_preferences", keyCols: ["trip_id"] },
  { table: "planner_availability_marks", keyCols: ["trip_id", "date"] },
  { table: "planner_decision_votes", keyCols: ["decision_id"] },
  { table: "planner_item_ratings", keyCols: ["item_id"] },
  { table: "planner_trip_reviews", keyCols: ["trip_id"] },
];

async function mergeCompositeTable(
  admin: SupabaseClient,
  table: string,
  keyCols: string[],
  staleId: string,
  keepId: string
) {
  const staleResult = await admin.from(table).select(keyCols.join(",")).eq("user_id", staleId);
  const staleRows = staleResult.data as unknown as Record<string, unknown>[] | null;
  if (!staleRows || staleRows.length === 0) return;

  const keepResult = await admin.from(table).select(keyCols.join(",")).eq("user_id", keepId);
  const keepRows = keepResult.data as unknown as Record<string, unknown>[] | null;
  const keyOf = (row: Record<string, unknown>) => keyCols.map((c) => String(row[c])).join("|");
  const keepKeys = new Set((keepRows ?? []).map(keyOf));

  for (const row of staleRows) {
    if (keepKeys.has(keyOf(row))) {
      // The account we're keeping already has a row for this trip/decision/item — drop the stale one.
      let del = admin.from(table).delete().eq("user_id", staleId);
      for (const c of keyCols) del = del.eq(c, row[c] as string);
      await del;
    } else {
      let upd = admin.from(table).update({ user_id: keepId }).eq("user_id", staleId);
      for (const c of keyCols) upd = upd.eq(c, row[c] as string);
      await upd;
    }
  }
}

/**
 * Folds a stale planner_users row into the one being kept: reassigns
 * everything it owns or is a member of, preferring the kept account's own
 * data on conflict, then deletes the stale row and its orphaned auth user.
 * Used when linking a phone/email to an account turns up an existing,
 * disconnected account for the same contact info.
 */
export async function mergePlannerUsers(
  admin: SupabaseClient,
  staleId: string,
  keepId: string,
  staleAuthUserId: string | null
) {
  for (const { table, column } of OWNER_COLUMNS) {
    await admin.from(table).update({ [column]: keepId }).eq(column, staleId);
  }

  for (const { table, keyCols } of COMPOSITE_MEMBERSHIP_TABLES) {
    await mergeCompositeTable(admin, table, keyCols, staleId, keepId);
  }

  await admin.from("planner_users").delete().eq("id", staleId);

  if (staleAuthUserId) {
    await admin.auth.admin.deleteUser(staleAuthUserId).catch(() => {
      // Best-effort — a leftover unused auth user is harmless if this fails.
    });
  }
}
