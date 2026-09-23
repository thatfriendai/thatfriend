import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhoneDigits, toE164 } from "./phone";

/**
 * Finds a planner_users row whose phone matches `fromDigits` (digits only,
 * no "+"). Every write to planner_users.phone goes through toE164 (phone
 * sign-in, organizer invites), so this is an exact indexed match on the
 * E.164 form — it used to load every row with a phone and compare in JS,
 * which silently stopped finding anyone past PostgREST's 1000-row default
 * page. Throws on a DB error rather than treating it as "no match" — a
 * lookup failure isn't the same thing as an unrecognized number, and
 * telling someone to "sign in first" when the real problem is a database
 * hiccup is actively misleading.
 */
export async function findPlannerUserByPhone(admin: SupabaseClient, fromDigits: string) {
  const { data, error } = await admin
    .from("planner_users")
    .select("id, phone, whatsapp_opt_in, notify_sms, sms_opted_in_at")
    .eq("phone", toE164(`+${normalizePhoneDigits(fromDigits)}`))
    .maybeSingle();

  if (error) throw new Error(`Phone lookup failed: ${error.message}`);
  return data ?? null;
}

/**
 * Same lookup, but provisions a bare planner_users row (phone only, no
 * name/email/auth) when none exists yet. Used by the organizer invite flow,
 * which knows a real phone number before the invitee has ever touched the
 * app — this is the only place outside phone sign-in that creates an
 * account, and it's deliberately scoped to "an organizer entered this exact
 * number," not "someone texted us" (the inbound webhooks still refuse to
 * create accounts from arbitrary inbound text).
 */
export async function findOrCreatePlannerUserByPhone(admin: SupabaseClient, e164Phone: string) {
  const digits = normalizePhoneDigits(e164Phone);
  const existing = await findPlannerUserByPhone(admin, digits);
  if (existing) return existing;

  const { data: created, error } = await admin
    .from("planner_users")
    .insert({ phone: e164Phone })
    .select("id, phone, whatsapp_opt_in, notify_sms, sms_opted_in_at")
    .single();

  if (error?.code === "23505") {
    // Lost a race with a concurrent invite for the same number — someone
    // else's insert won, fall back to reading it.
    const raced = await findPlannerUserByPhone(admin, digits);
    if (raced) return raced;
  }
  if (error || !created) throw new Error(`Could not create a user for that phone: ${error?.message ?? "unknown error"}`);
  return created;
}

// Every column in supabase/planner_schema.sql that references
// planner_users (id) must be handled below — anything left out is either
// cascade-deleted or nulled when the stale row is deleted at the end,
// i.e. silently lost from the merged account. When adding a table that
// references planner_users, add it here too. The one deliberate omission
// is planner_email_links: a pending "add email" request for the stale
// account is meaningless once it's gone, so the cascade dropping it is
// correct.

/** Tables where a planner_users.id shows up as a plain "owner" column — no uniqueness constraint, so reassigning can't collide. */
const OWNER_COLUMNS: { table: string; column: string }[] = [
  { table: "planner_trips", column: "created_by" },
  { table: "planner_trips", column: "dates_flagged_by" },
  { table: "planner_trips", column: "preferences_skipped_by" },
  { table: "planner_invites", column: "accepted_by" },
  { table: "planner_itinerary_items", column: "created_by" },
  { table: "planner_places", column: "added_by" },
  { table: "planner_resources", column: "added_by" },
  { table: "planner_decisions", column: "created_by" },
  { table: "planner_decision_notes", column: "created_by" },
  { table: "planner_saved_places", column: "source_user_id" },
  { table: "planner_profile_views", column: "profile_user_id" },
  { table: "planner_profile_views", column: "viewer_id" },
  { table: "planner_trip_essentials", column: "created_by" },
  { table: "planner_trip_lessons", column: "user_id" },
  { table: "planner_ride_groups", column: "created_by" },
];

interface CompositeTable {
  table: string;
  /** The planner_users column; defaults to "user_id". */
  userCol?: string;
  /** The other columns in the table's unique key alongside userCol. */
  keyCols: string[];
  /** planner_memberships only: a dropped duplicate's 'owner' role carries over to the kept row. */
  keepOwnerRole?: boolean;
}

/** Tables keyed on (user + these extra columns) — reassigning a stale row can collide with a row the kept account already has. */
const COMPOSITE_MEMBERSHIP_TABLES: CompositeTable[] = [
  { table: "planner_memberships", keyCols: ["trip_id"], keepOwnerRole: true },
  { table: "planner_preferences", keyCols: ["trip_id"] },
  { table: "planner_availability_marks", keyCols: ["trip_id", "date"] },
  { table: "planner_decision_votes", keyCols: ["decision_id"] },
  { table: "planner_item_ratings", keyCols: ["item_id"] },
  { table: "planner_trip_reviews", keyCols: ["trip_id"] },
  { table: "planner_place_ratings", keyCols: ["trip_id", "place_id"] },
  { table: "planner_join_requests", keyCols: ["trip_id"] },
  { table: "planner_trip_saves", keyCols: ["trip_id"] },
  // Unique only where source_place_id is not null — null-keyed rows never
  // collide and are always reassigned (see mergeCompositeTable).
  { table: "planner_saved_places", keyCols: ["source_place_id"] },
  { table: "planner_backfilled_countries", keyCols: ["country_code"] },
  { table: "planner_guide_interactions", keyCols: ["guide_id", "kind"] },
  { table: "planner_travel_legs", keyCols: ["trip_id", "direction"] },
  // Self-follows (stale <-> kept) are removed first in mergePlannerUsers,
  // so what's left merges like any other composite key.
  { table: "planner_follows", userCol: "follower_id", keyCols: ["followee_id"] },
  { table: "planner_follows", userCol: "followee_id", keyCols: ["follower_id"] },
];

async function mergeCompositeTable(
  admin: SupabaseClient,
  { table, userCol = "user_id", keyCols, keepOwnerRole }: CompositeTable,
  staleId: string,
  keepId: string
) {
  const selectCols = [...keyCols, ...(keepOwnerRole ? ["role"] : [])].join(",");
  const staleResult = await admin.from(table).select(selectCols).eq(userCol, staleId);
  const staleRows = staleResult.data as unknown as Record<string, unknown>[] | null;
  if (!staleRows || staleRows.length === 0) return;

  const keepResult = await admin.from(table).select(selectCols).eq(userCol, keepId);
  const keepRows = (keepResult.data as unknown as Record<string, unknown>[] | null) ?? [];
  const keyOf = (row: Record<string, unknown>) => keyCols.map((c) => String(row[c])).join("|");
  const keepByKey = new Map(keepRows.map((row) => [keyOf(row), row]));

  // A null in the key never collides (Postgres unique constraints treat
  // nulls as distinct), and needs .is() rather than .eq() to match.
  const matchRow = <Q extends { eq: (c: string, v: string) => Q; is: (c: string, v: null) => Q }>(query: Q, row: Record<string, unknown>) => {
    let q = query.eq(userCol, staleId);
    for (const c of keyCols) q = row[c] === null ? q.is(c, null) : q.eq(c, row[c] as string);
    return q;
  };

  for (const row of staleRows) {
    const hasNullKey = keyCols.some((c) => row[c] === null);
    const keepRow = hasNullKey ? undefined : keepByKey.get(keyOf(row));
    if (keepRow) {
      // The account we're keeping already has a row for this trip/decision/item — drop the stale one.
      await matchRow(admin.from(table).delete(), row);
      // ...but not the stale row's ownership: dropping an 'owner'
      // membership in favor of a 'member' one would leave the trip's
      // organizer unable to manage their own trip.
      if (keepOwnerRole && row.role === "owner" && keepRow.role !== "owner") {
        let upd = admin.from(table).update({ role: "owner" }).eq(userCol, keepId);
        for (const c of keyCols) upd = upd.eq(c, row[c] as string);
        await upd;
      }
    } else {
      await matchRow(admin.from(table).update({ [userCol]: keepId }), row);
    }
  }
}

/**
 * planner_friendships stores each pair once, ordered (user_a < user_b by a
 * check constraint), so a stale id can't just be swapped in place — the
 * pair may need to flip columns. Re-inserts each stale pair in canonical
 * order for the kept account, skipping ones it already has and the pair
 * (stale, kept) itself, which would become a self-friendship.
 */
async function mergeFriendships(admin: SupabaseClient, staleId: string, keepId: string) {
  const { data: rows } = await admin
    .from("planner_friendships")
    .select("user_a, user_b, source, created_at")
    .or(`user_a.eq.${staleId},user_b.eq.${staleId}`);

  for (const row of rows ?? []) {
    const other = row.user_a === staleId ? row.user_b : row.user_a;
    await admin.from("planner_friendships").delete().eq("user_a", row.user_a).eq("user_b", row.user_b);
    if (other === keepId) continue;
    const [a, b] = keepId < other ? [keepId, other] : [other, keepId];
    await admin
      .from("planner_friendships")
      .upsert(
        { user_a: a, user_b: b, source: row.source, created_at: row.created_at },
        { onConflict: "user_a,user_b", ignoreDuplicates: true }
      );
  }
}

/** planner_ride_groups.member_ids is a plain uuid[] (no FK), so it'd keep pointing at the deleted row rather than cascade. */
async function mergeRideGroupMembers(admin: SupabaseClient, staleId: string, keepId: string) {
  const { data: rides } = await admin.from("planner_ride_groups").select("id, member_ids").contains("member_ids", [staleId]);
  for (const ride of rides ?? []) {
    const memberIds = [...new Set((ride.member_ids as string[]).map((id) => (id === staleId ? keepId : id)))];
    await admin.from("planner_ride_groups").update({ member_ids: memberIds }).eq("id", ride.id);
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
  // Visits between the two halves of the same person aren't profile views.
  await admin.from("planner_profile_views").delete().eq("profile_user_id", keepId).eq("viewer_id", keepId);

  // Following yourself is rejected by a check constraint — drop the
  // stale <-> kept follows before the composite merge would create one.
  await admin.from("planner_follows").delete().eq("follower_id", staleId).eq("followee_id", keepId);
  await admin.from("planner_follows").delete().eq("follower_id", keepId).eq("followee_id", staleId);

  for (const table of COMPOSITE_MEMBERSHIP_TABLES) {
    await mergeCompositeTable(admin, table, staleId, keepId);
  }

  await mergeFriendships(admin, staleId, keepId);
  await mergeRideGroupMembers(admin, staleId, keepId);

  await admin.from("planner_users").delete().eq("id", staleId);

  if (staleAuthUserId) {
    await admin.auth.admin.deleteUser(staleAuthUserId).catch(() => {
      // Best-effort — a leftover unused auth user is harmless if this fails.
    });
  }
}
