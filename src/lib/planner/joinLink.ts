import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { joinTripById, removedFromTripMessage, type JoinOutcome } from "./smsTripStart";
import { recordConsentEvent, type ConsentMethod } from "./consent";
import { toE164 } from "./phone";

interface JoiningUser {
  id: string;
  phone: string | null;
  notify_sms: boolean;
  sms_opted_in_at: string | null;
}

export type ResolvedInvite =
  | {
      tripId: string;
      source: "link";
      inviteId: string;
      // planner_invites rows are both the trip-wide share link (channel
      // "link") and one-person email invites (channel "email") — same
      // token shape, very different reach. See acceptInviteToken.
      channel: string;
      sentTo: string | null;
      acceptedBy: string | null;
      createdAt: string;
    }
  | { tripId: string; source: "phone"; inviteId: string; phone: string; clickedAt: string | null; createdAt: string };

/**
 * A join token is one of two things: the trip-wide share link
 * (planner_invites, channel "link" — what the organizer's Invite button
 * puts on the share sheet) or a per-phone invite (planner_trip_invites —
 * what the invite text carries). Both land on a "Join <trip>" page and
 * both end up here.
 */
export async function resolveInviteToken(admin: SupabaseClient, token: string): Promise<ResolvedInvite | null> {
  if (!token) return null;

  const { data: link } = await admin
    .from("planner_invites")
    .select("id, trip_id, channel, sent_to, accepted_by, created_at")
    .eq("token", token)
    .maybeSingle();
  if (link) {
    return {
      tripId: link.trip_id,
      source: "link",
      inviteId: link.id,
      channel: link.channel,
      sentTo: link.sent_to ?? null,
      acceptedBy: link.accepted_by ?? null,
      createdAt: link.created_at,
    };
  }

  const { data: phoneInvite } = await admin
    .from("planner_trip_invites")
    .select("id, trip_id, phone, clicked_at, expires_at, created_at")
    .eq("token", token)
    .maybeSingle();
  if (phoneInvite && new Date(phoneInvite.expires_at) > new Date()) {
    return {
      tripId: phoneInvite.trip_id,
      source: "phone",
      inviteId: phoneInvite.id,
      phone: phoneInvite.phone,
      clickedAt: phoneInvite.clicked_at,
      createdAt: phoneInvite.created_at,
    };
  }
  return null;
}

/** Whether a per-phone invite sent to `invitePhone` belongs to a user with `userPhone` (compared in E.164, as both are stored). */
export function inviteIsForPhone(invitePhone: string, userPhone: string | null): boolean {
  if (!userPhone) return false;
  return toE164(userPhone) === toE164(invitePhone);
}

// Same shape as the web form's own check (src/app/api/v2/users/me/email),
// plus RFC 5321's 254-character ceiling so a pasted essay can't be "sent to".
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whether `email` (already trimmed/lowercased) is plausible enough to send an invite to. */
export function isInvitableEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

/**
 * Whether a planner_invites row is a one-person email invite that someone
 * else has already used. The share link (channel "link") is meant for
 * many people; an email invite was sent to one, so after its first accept
 * it stops working for anyone else — otherwise a forwarded email is a
 * trip-wide link forever. The original acceptor re-opening it still works.
 */
export function emailInviteUsedBySomeoneElse(
  invite: { channel: string; acceptedBy: string | null },
  userId: string
): boolean {
  return invite.channel === "email" && invite.acceptedBy !== null && invite.acceptedBy !== userId;
}

/**
 * joinTripById's "removed" outcome, folded into the shape AcceptOutcome's
 * callers already handle. Those callers (the join API route, the auth
 * callbacks, both SMS webhooks) treat anything that isn't joined/
 * already_member as "didn't get in" and either show `error` or fall
 * through — adding a new outcome there would hand a removed person a
 * redirect to a trip page they can't see.
 */
function foldRemoved(joined: JoinOutcome): Exclude<JoinOutcome, { outcome: "removed" }> {
  return joined.outcome === "removed" ? { outcome: "error", error: removedFromTripMessage(joined.tripName) } : joined;
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
 *
 * A per-phone invite (source "phone") is refused to an account whose phone
 * is a *different* number — forwarding the text to someone who's already
 * on That Friend by phone mustn't walk them into the trip. An account with
 * no phone yet (a friend who signed up on the web by email, then got the
 * texted invite) is let in: refusing them strands the invitee we most want,
 * and it's no looser than the trip-wide share link. Anyone refused gets
 * "wrong_phone"; the share link and the join code remain the ways in.
 */
export async function acceptInviteToken(
  admin: SupabaseClient,
  user: JoiningUser,
  token: string
): Promise<AcceptOutcome | { outcome: "wrong_phone" }> {
  const invite = await resolveInviteToken(admin, token);
  if (!invite) return { outcome: "not_found" };
  if (invite.source === "phone" && user.phone && !inviteIsForPhone(invite.phone, user.phone)) {
    return { outcome: "wrong_phone" };
  }

  if (invite.source === "link" && emailInviteUsedBySomeoneElse(invite, user.id)) return { outcome: "not_found" };

  // Only an invite aimed at this person can bring back someone who was
  // removed (see mayRejoinTrip) — their own number's text invite, or an
  // email invite sent to their address. The share link never can.
  let targetedInviteCreatedAt: string | null = null;
  if (invite.source === "phone") {
    if (inviteIsForPhone(invite.phone, user.phone)) targetedInviteCreatedAt = invite.createdAt;
  } else if (invite.channel === "email" && invite.sentTo) {
    const { data: account } = await admin.from("planner_users").select("email").eq("id", user.id).maybeSingle();
    if (account?.email && account.email.trim().toLowerCase() === invite.sentTo.trim().toLowerCase()) {
      targetedInviteCreatedAt = invite.createdAt;
    }
  }

  const joined = foldRemoved(await joinTripById(admin, user, invite.tripId, { targetedInviteCreatedAt }));
  if (joined.outcome === "not_found") return { outcome: "not_found" };
  if (joined.outcome === "error") return joined;

  if (invite.source === "link" && invite.channel === "email") {
    // First accept claims it — the conditional update keeps a concurrent
    // second accept from overwriting who it belongs to.
    await admin.from("planner_invites").update({ accepted_by: user.id }).eq("id", invite.inviteId).is("accepted_by", null);
  } else if (invite.source === "link") {
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
    .select("id, trip_id, clicked_at, created_at")
    .eq("phone", toE164(user.phone))
    .is("joined_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pendingInvite) return null;

  const method: ConsentMethod = pendingInvite.clicked_at ? "link_tap" : "join_code";
  await recordConsentEvent(admin, user, method, pendingInvite.trip_id);
  // Keyed on their own phone, so this is always a targeted invite.
  const joined = foldRemoved(
    await joinTripById(admin, user, pendingInvite.trip_id, { targetedInviteCreatedAt: pendingInvite.created_at })
  );
  if (joined.outcome === "not_found" || joined.outcome === "error") return joined;
  return { outcome: joined.outcome, tripId: pendingInvite.trip_id, tripName: joined.tripName };
}
