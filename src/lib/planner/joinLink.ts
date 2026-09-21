import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { joinTripById } from "./smsTripStart";
import { recordConsentEvent, type ConsentMethod } from "./consent";
import { toE164 } from "./phone";

interface JoiningUser {
  id: string;
  phone: string | null;
  notify_sms: boolean;
  sms_opted_in_at: string | null;
}

export type ResolvedInvite =
  | { tripId: string; source: "link"; inviteId: string }
  | { tripId: string; source: "phone"; inviteId: string; phone: string; clickedAt: string | null };

/**
 * A join token is one of two things: the trip-wide share link
 * (planner_invites, channel "link" — what the organizer's Invite button
 * puts on the share sheet) or a per-phone invite (planner_trip_invites —
 * what the invite text carries). Both land on a "Join <trip>" page and
 * both end up here.
 */
export async function resolveInviteToken(admin: SupabaseClient, token: string): Promise<ResolvedInvite | null> {
  if (!token) return null;

  const { data: link } = await admin.from("planner_invites").select("id, trip_id").eq("token", token).maybeSingle();
  if (link) return { tripId: link.trip_id, source: "link", inviteId: link.id };

  const { data: phoneInvite } = await admin
    .from("planner_trip_invites")
    .select("id, trip_id, phone, clicked_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (phoneInvite && new Date(phoneInvite.expires_at) > new Date()) {
    return {
      tripId: phoneInvite.trip_id,
      source: "phone",
      inviteId: phoneInvite.id,
      phone: phoneInvite.phone,
      clickedAt: phoneInvite.clicked_at,
    };
  }
  return null;
}

export type AcceptOutcome =
  | { outcome: "joined" | "already_member"; tripId: string; tripName: string }
  | { outcome: "not_found" }
  | { outcome: "error"; error: string };

/**
 * The one consent event in the whole invite flow: tapping "Join <trip>"
 * under the line "you'll get texts from That Friend about this trip"
 * (src/app/planner/join/[token], src/app/j/[token]). Joining and opting
 * in are the same action — there's no second screen and no separate
 * "reply JOIN" text afterwards. Membership itself goes through the same
 * joinTripById as a texted "1", so the group-thread sync and the invite
 * funnel row are handled identically whichever way someone came in.
 */
export async function acceptInviteToken(admin: SupabaseClient, user: JoiningUser, token: string): Promise<AcceptOutcome> {
  const invite = await resolveInviteToken(admin, token);
  if (!invite) return { outcome: "not_found" };

  const joined = await joinTripById(admin, user, invite.tripId);
  if (joined.outcome === "not_found") return { outcome: "not_found" };
  if (joined.outcome === "error") return joined;

  if (invite.source === "link") {
    await admin.from("planner_invites").update({ accepted_by: user.id }).eq("id", invite.inviteId);
  }

  if (user.phone) {
    await recordConsentEvent(admin, user, "link_tap", invite.tripId);
  }

  return { outcome: joined.outcome, tripId: invite.tripId, tripName: joined.tripName };
}

/** The most recent invite this phone hasn't acted on yet, with who sent it — for a greeting that points at it. */
export async function findPendingInvite(
  admin: SupabaseClient,
  user: { phone: string | null }
): Promise<{ tripId: string; tripName: string; organizerFirstName: string } | null> {
  if (!user.phone) return null;
  const { data: invite } = await admin
    .from("planner_trip_invites")
    .select("trip_id, planner_trips(name, created_by)")
    .eq("phone", toE164(user.phone))
    .is("joined_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const trip = invite?.planner_trips as unknown as { name: string; created_by: string } | null;
  if (!invite || !trip) return null;
  const { data: owner } = await admin.from("planner_users").select("name").eq("id", trip.created_by).maybeSingle();
  return { tripId: invite.trip_id, tripName: trip.name, organizerFirstName: owner?.name?.split(" ")[0] || "a friend" };
}

/**
 * A bare "1" or "START" texted back to a pending invite joins that trip —
 * the lowest-friction accept, scoped to whoever the invite was actually
 * sent to (keyed on the recipient's own phone, so a forwarded screenshot
 * can't resolve here). Only fires when such an invite exists; a "1" from
 * anyone else falls through to normal handling. Both inbound webhooks use
 * this, since a group-thread member's reply lands in the Conversation
 * webhook, not the 1:1 one.
 */
export async function acceptPendingInviteByReply(
  admin: SupabaseClient,
  user: JoiningUser,
  body: string
): Promise<AcceptOutcome | null> {
  if (!user.phone || !/^(?:1|start|yes|join)$/i.test(body.trim())) return null;

  const { data: pendingInvite } = await admin
    .from("planner_trip_invites")
    .select("id, trip_id, clicked_at")
    .eq("phone", toE164(user.phone))
    .is("joined_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pendingInvite) return null;

  const method: ConsentMethod = pendingInvite.clicked_at ? "link_tap" : "join_code";
  await recordConsentEvent(admin, user, method, pendingInvite.trip_id);
  const joined = await joinTripById(admin, user, pendingInvite.trip_id);
  if (joined.outcome === "not_found" || joined.outcome === "error") return joined;
  return { outcome: joined.outcome, tripId: pendingInvite.trip_id, tripName: joined.tripName };
}
