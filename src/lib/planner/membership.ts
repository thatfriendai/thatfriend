import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toE164 } from "./phone";
import { removeParticipantFromConversation } from "@/lib/twilio/conversations";

export interface ActiveMember {
  user_id: string;
  role: "owner" | "member";
  name: string | null;
  email: string | null;
  phone: string | null;
  notify_sms: boolean;
  whatsapp_opt_in: boolean;
}

/**
 * Every currently-active (not left/removed) member of a trip — the shared
 * "who's really on this trip" query. Roster displays, vote tallies, nudge
 * targets, and proactive-text recipient lists should all read through this
 * instead of querying planner_memberships directly, so a departed member
 * disappears from every one of them at once, not just wherever someone
 * remembered to add the filter.
 */
export async function activeMembersOf(admin: SupabaseClient, tripId: string): Promise<ActiveMember[]> {
  // Explicit FK name required: planner_memberships now has two
  // relationships to planner_users (user_id, and P1-B's removed_by) —
  // PostgREST can't pick one on its own and fails the whole query with
  // no data, which this silently swallowed (`data` just came back null,
  // read as "no active members"). Found live-verifying P2-7: this broke
  // nudges, notifyTrip's group texts, and rating-capture targeting for
  // every trip, not just new ones — same class of bug as the
  // decided_option_id fix already applied to the decisions query in
  // page.tsx.
  const { data, error } = await admin
    .from("planner_memberships")
    .select("user_id, role, planner_users!planner_memberships_user_id_fkey(name, email, phone, notify_sms, whatsapp_opt_in)")
    .eq("trip_id", tripId)
    .eq("status", "active");
  if (error) {
    console.error("activeMembersOf query failed", error);
    return [];
  }
  return (data ?? []).map((m) => {
    const u = m.planner_users as unknown as {
      name: string | null;
      email: string | null;
      phone: string | null;
      notify_sms: boolean;
      whatsapp_opt_in: boolean;
    } | null;
    return {
      user_id: m.user_id as string,
      role: m.role as "owner" | "member",
      name: u?.name ?? null,
      email: u?.email ?? null,
      phone: u?.phone ?? null,
      notify_sms: u?.notify_sms ?? false,
      whatsapp_opt_in: u?.whatsapp_opt_in ?? false,
    };
  });
}

export async function isActiveMember(admin: SupabaseClient, tripId: string, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(data);
}

/**
 * Whether someone with this (possibly absent) membership row may become
 * active on the trip again. Someone who left on their own can walk back in
 * through any door — the code, the share link, an invite. Someone an
 * organizer removed may only come back through a targeted invite (their own
 * phone or email) made *after* the removal: a join code or share link they
 * still have from before is exactly what removing them was meant to shut.
 * A removed row with no left_at (shouldn't exist — departMember always sets
 * it) can't be dated, so any targeted invite is taken as the way back.
 */
export function mayRejoinTrip(
  existing: { status: string; left_at: string | null } | null,
  targetedInviteCreatedAt: string | null | undefined
): boolean {
  if (!existing || existing.status !== "removed") return true;
  if (!targetedInviteCreatedAt) return false;
  if (!existing.left_at) return true;
  return new Date(targetedInviteCreatedAt).getTime() > new Date(existing.left_at).getTime();
}

/**
 * "LEAVE" texted alone — an exact match, not a substring, same reasoning
 * as STOP/START (src/lib/planner/consent.ts): "leave" is an ordinary word
 * in real conversation ("can't wait to leave"), so only the bare word by
 * itself is treated as the command.
 */
export function isLeaveCommand(body: string): boolean {
  return body.trim().toLowerCase() === "leave";
}

export type DepartOutcome =
  | { outcome: "left" | "removed" }
  | { outcome: "not_found" }
  | { outcome: "already_gone" }
  | { outcome: "must_transfer_first" }
  | { outcome: "error"; error: string };

/**
 * Marks a membership left/removed. Shared by self-leave and organizer-
 * remove, so the two can't drift: withdraws votes on still-open decisions
 * (closed-decision votes stay as history — no DB cascade exists for this,
 * confirmed by investigation, so it's explicit here), unbinds them from
 * the trip's group Conversation so texts stop immediately, and leaves a
 * low-key note in the trip's activity. Refuses an owner outright — they
 * transfer the role first (see transferOwner below).
 */
export async function departMember(
  admin: SupabaseClient,
  tripId: string,
  userId: string,
  reason: { kind: "left" } | { kind: "removed"; removedBy: string }
): Promise<DepartOutcome> {
  const { data: membership } = await admin
    .from("planner_memberships")
    .select("role, status")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return { outcome: "not_found" };
  if (membership.status !== "active") return { outcome: "already_gone" };
  if (membership.role === "owner") return { outcome: "must_transfer_first" };

  const { error } = await admin
    .from("planner_memberships")
    .update({
      status: reason.kind,
      left_at: new Date().toISOString(),
      removed_by: reason.kind === "removed" ? reason.removedBy : null,
    })
    .eq("trip_id", tripId)
    .eq("user_id", userId);
  if (error) return { outcome: "error", error: error.message };

  const { data: openDecisions } = await admin
    .from("planner_decisions")
    .select("id")
    .eq("trip_id", tripId)
    .eq("status", "open");
  const openIds = (openDecisions ?? []).map((d) => d.id as string);
  if (openIds.length > 0) {
    await admin.from("planner_decision_votes").delete().eq("user_id", userId).in("decision_id", openIds);
  }

  const [{ data: trip }, { data: person }] = await Promise.all([
    admin.from("planner_trips").select("twilio_conversation_sid").eq("id", tripId).maybeSingle(),
    admin.from("planner_users").select("phone, name, email").eq("id", userId).maybeSingle(),
  ]);
  if (trip?.twilio_conversation_sid && person?.phone) {
    await removeParticipantFromConversation(trip.twilio_conversation_sid, toE164(person.phone)).catch((e) => {
      console.error("[membership] couldn't unbind from conversation", tripId, userId, e);
    });
  }

  const label = person?.name?.split(" ")[0] || person?.email?.split("@")[0] || "Someone";
  await admin.from("planner_trip_activity").insert({
    trip_id: tripId,
    text: reason.kind === "left" ? `${label} left the trip.` : `${label} was removed from the trip.`,
  });

  return { outcome: reason.kind };
}

export type TransferOutcome = { outcome: "ok" } | { outcome: "not_member" } | { outcome: "error"; error: string };

/** Hands the owner role to another active member, chosen by the current owner — not an automatic succession. */
export async function transferOwner(
  admin: SupabaseClient,
  tripId: string,
  fromUserId: string,
  toUserId: string
): Promise<TransferOutcome> {
  if (!(await isActiveMember(admin, tripId, toUserId))) return { outcome: "not_member" };

  // Promote first, then demote: if the second write fails the trip briefly
  // has two owners (harmless, and the old owner can retry), rather than the
  // other order's failure mode — a trip with no owner at all, which nobody
  // can manage or hand back.
  const { error: promoteError } = await admin
    .from("planner_memberships")
    .update({ role: "owner" })
    .eq("trip_id", tripId)
    .eq("user_id", toUserId);
  if (promoteError) return { outcome: "error", error: promoteError.message };

  const { error: demoteError } = await admin
    .from("planner_memberships")
    .update({ role: "member" })
    .eq("trip_id", tripId)
    .eq("user_id", fromUserId);
  if (demoteError) return { outcome: "error", error: demoteError.message };

  await admin.from("planner_trips").update({ created_by: toUserId }).eq("id", tripId);
  return { outcome: "ok" };
}
