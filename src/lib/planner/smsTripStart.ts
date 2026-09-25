import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateToken, generateJoinCode } from "./tokens";
import { addParticipantToConversation } from "@/lib/twilio/conversations";
import { autoFriendTripMembers } from "./follows";
import { toE164 } from "./phone";
import { MAX_TRAVELERS_PER_TRIP } from "@/config/limits";

/**
 * Whether the word after "join" was plausibly meant as a join code, so a
 * miss deserves "that code doesn't match" instead of being read as a normal
 * message. Codes are CITY + 3 characters and usually carry a digit; people
 * who type one from a screen tend to keep it in caps. "join tomorrow" or
 * "join them" in a group thread is conversation, not a typo'd code.
 */
export function looksLikeJoinCode(word: string): boolean {
  return /\d/.test(word) || (word.length >= 4 && word === word.toUpperCase());
}

interface PlannerUserLite {
  id: string;
  phone: string | null;
}

/**
 * Starts a brand-new trip entirely from a text — no app visit needed. Mirrors
 * the web app's own trip-creation route (POST /api/v2/trips): same defaults,
 * same owner membership, same "link" invite — plus a join_code (this is the
 * only creation path that hands one back over SMS). The group Conversation
 * is deliberately NOT started here: it unlocks from the trip page once the
 * invited travelers have joined (see the "Who's in" section), and starting
 * it early would also bind the organizer's phone to it, routing their very
 * next 1:1 text — "here are their numbers" — into the group webhook.
 */
export async function createTripFromText(
  admin: SupabaseClient,
  user: PlannerUserLite,
  destination: string | null
): Promise<{ tripId: string; tripName: string; joinCode: string } | { error: string }> {
  const name = destination?.trim() || "New trip";

  let joinCode = generateJoinCode(destination);
  const { data: trip, error: tripError } = await admin
    .from("planner_trips")
    .insert({
      name,
      destination: destination?.trim() || null,
      privacy: "private",
      created_by: user.id,
      join_code: joinCode,
    })
    .select("id, name, twilio_conversation_sid")
    .single();

  // A join_code collision is astronomically unlikely (3 random chars on
  // top of the destination) but cheap to retry once rather than fail the
  // whole text over it.
  let created = trip;
  if (tripError?.code === "23505") {
    joinCode = generateJoinCode(destination);
    const retry = await admin
      .from("planner_trips")
      .insert({ name, destination: destination?.trim() || null, privacy: "private", created_by: user.id, join_code: joinCode })
      .select("id, name, twilio_conversation_sid")
      .single();
    created = retry.data;
    if (retry.error || !created) return { error: retry.error?.message ?? "Could not start that trip." };
  } else if (tripError || !created) {
    return { error: tripError?.message ?? "Could not start that trip." };
  }

  await admin.from("planner_memberships").insert({ trip_id: created.id, user_id: user.id, role: "owner" });
  await admin.from("planner_invites").insert({ trip_id: created.id, token: generateToken(), channel: "link" });

  return { tripId: created.id, tripName: created.name, joinCode };
}

type JoinOutcome =
  | { outcome: "joined"; tripName: string }
  | { outcome: "already_member"; tripName: string }
  | { outcome: "not_found" }
  | { outcome: "error"; error: string };

/**
 * The shared "make this user a member of this trip, over SMS" path — used
 * both by a typed join_code (below, once it's resolved to a trip id) and by
 * a bare "1"/"START" reply to a per-phone invite (src/app/api/v2/twilio),
 * which already knows the trip id directly and has no code to resolve.
 */
export async function joinTripById(admin: SupabaseClient, user: PlannerUserLite, tripId: string): Promise<JoinOutcome> {
  const { data: trip } = await admin
    .from("planner_trips")
    .select("id, name, twilio_conversation_sid")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return { outcome: "not_found" };

  const { data: existing } = await admin
    .from("planner_memberships")
    .select("trip_id, status")
    .eq("trip_id", trip.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.status === "active") return { outcome: "already_member", tripName: trip.name };

  const { count } = await admin
    .from("planner_memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("trip_id", trip.id)
    .eq("status", "active");
  if ((count ?? 0) >= MAX_TRAVELERS_PER_TRIP) {
    return { outcome: "error", error: `This trip is already at its limit of ${MAX_TRAVELERS_PER_TRIP} travelers.` };
  }

  // A left/removed row rejoining flips back to active (the composite PK
  // would otherwise reject a second insert) rather than being blocked or
  // duplicated — P1-B: "a removed or departed traveler can be re-invited
  // through the normal invite flow."
  const { error } = existing
    ? await admin
        .from("planner_memberships")
        .update({ role: "member", status: "active", left_at: null, removed_by: null })
        .eq("trip_id", trip.id)
        .eq("user_id", user.id)
    : await admin.from("planner_memberships").insert({ trip_id: trip.id, user_id: user.id, role: "member" });
  if (error) return { outcome: "error", error: error.message };

  await autoFriendTripMembers(admin, trip.id, user.id);

  if (trip.twilio_conversation_sid && user.phone) {
    await addParticipantToConversation(trip.twilio_conversation_sid, toE164(user.phone)).catch(() => {
      // Best-effort — they're a real member either way; group-text sync can catch up later.
    });
  }

  if (user.phone) {
    // Closes the funnel for a per-invite link/reply (src/app/j/[token],
    // or a bare "1"/"START") if this join came from one — matches on
    // (trip, phone) regardless of which path got them here.
    await admin
      .from("planner_trip_invites")
      .update({ joined_at: new Date().toISOString() })
      .eq("trip_id", trip.id)
      .eq("phone", toE164(user.phone))
      .is("joined_at", null);
  }

  return { outcome: "joined", tripName: trip.name };
}

/**
 * The text-message equivalent of clicking a join link — resolves a
 * join_code straight to a membership, no link or app visit required.
 */
export async function joinTripByCode(admin: SupabaseClient, user: PlannerUserLite, rawCode: string): Promise<JoinOutcome> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { outcome: "not_found" };

  const { data: trip } = await admin.from("planner_trips").select("id").eq("join_code", code).maybeSingle();
  if (!trip) return { outcome: "not_found" };

  return joinTripById(admin, user, trip.id);
}
