import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateToken, generateJoinCode } from "./tokens";
import { getOrCreateTripConversation, addParticipantToConversation } from "@/lib/twilio/conversations";
import { autoFriendTripMembers } from "./follows";
import { toE164 } from "./phone";

interface PlannerUserLite {
  id: string;
  phone: string | null;
}

/**
 * Starts a brand-new trip entirely from a text — no app visit needed. Mirrors
 * the web app's own trip-creation route (POST /api/v2/trips): same defaults,
 * same owner membership, same "link" invite — plus a join_code (this is the
 * only creation path that hands one back over SMS) and, since the whole
 * point is a group text, the Conversation is started immediately rather than
 * waiting for someone to click "Start a group text" in the app.
 */
export async function createTripFromText(
  admin: SupabaseClient,
  user: PlannerUserLite,
  destination: string | null
): Promise<{ tripName: string; joinCode: string } | { error: string }> {
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

  // Best-effort — if this fails, the trip still exists and "Start a group
  // text" is still available from the app as a fallback.
  try {
    await getOrCreateTripConversation(admin, {
      id: created.id,
      name: created.name,
      twilio_conversation_sid: created.twilio_conversation_sid,
    });
  } catch {
    // Swallowed — see comment above.
  }

  return { tripName: created.name, joinCode };
}

type JoinOutcome =
  | { outcome: "joined"; tripName: string }
  | { outcome: "already_member"; tripName: string }
  | { outcome: "not_found" }
  | { outcome: "error"; error: string };

/**
 * The text-message equivalent of clicking a join link — resolves a
 * join_code straight to a membership, no link or app visit required.
 */
export async function joinTripByCode(admin: SupabaseClient, user: PlannerUserLite, rawCode: string): Promise<JoinOutcome> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { outcome: "not_found" };

  const { data: trip } = await admin
    .from("planner_trips")
    .select("id, name, twilio_conversation_sid")
    .eq("join_code", code)
    .maybeSingle();
  if (!trip) return { outcome: "not_found" };

  const { data: existing } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("trip_id", trip.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { outcome: "already_member", tripName: trip.name };

  const { error } = await admin
    .from("planner_memberships")
    .insert({ trip_id: trip.id, user_id: user.id, role: "member" });
  if (error) return { outcome: "error", error: error.message };

  await autoFriendTripMembers(admin, trip.id, user.id);

  if (trip.twilio_conversation_sid && user.phone) {
    await addParticipantToConversation(trip.twilio_conversation_sid, toE164(user.phone)).catch(() => {
      // Best-effort — they're a real member either way; group-text sync can catch up later.
    });
  }

  if (user.phone) {
    // Closes the funnel for a per-invite link (src/app/j/[token]) if this
    // join came from one — matches on (trip, phone) whether they tapped the
    // link or just typed the code in from a screenshot/forward.
    await admin
      .from("planner_trip_invites")
      .update({ joined_at: new Date().toISOString() })
      .eq("trip_id", trip.id)
      .eq("phone", toE164(user.phone))
      .is("joined_at", null);
  }

  return { outcome: "joined", tripName: trip.name };
}
