import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pre-render existence/membership checks for proxy.ts. Every one of these
 * routes sits behind a sibling loading.tsx, which means its own notFound()
 * call fires too late to set a real 404 status — the loading fallback has
 * already started streaming a 200 by then (see loading.js's docs: "Status
 * Codes"). Checking here, before the page renders at all, is the only way
 * to get a correct status without losing the instant loading skeleton.
 * Kept separate from each page's own check, which stays as the real
 * access-control gate — this only decides what status code to send, so a
 * guard here should never be stricter than its page (a false 404 would
 * block real access) and never looser (a missed case just falls back to
 * the page's existing soft-404).
 */

/** Last non-empty path segment — every one of these tokenized routes puts the token there. */
function lastSegment(rest: string): string | null {
  const parts = rest.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

/** `/planner/trips/{id}` exactly — not `/planner/trips/new` and not a nested sub-route. */
export function matchTripPagePath(pathname: string): string | null {
  const match = pathname.match(/^\/planner\/trips\/([^/]+)$/);
  if (!match || match[1] === "new") return null;
  return match[1];
}

// preferences/dates/convergence/reviews: same "does this trip exist and am
// I a member" gate as the trip page itself, no other condition attached.
const TRIP_SUB_ROUTE_RE = /^\/planner\/trips\/([^/]+)\/(?:preferences|dates|convergence|reviews)$/;

/** `/planner/trips/{id}/{preferences|dates|convergence|reviews}` exactly. */
export function matchTripSubRoutePath(pathname: string): string | null {
  return pathname.match(TRIP_SUB_ROUTE_RE)?.[1] ?? null;
}

/** `/planner/trips/{id}/decisions/{decisionId}` exactly. */
export function matchTripDecisionPath(pathname: string): { tripId: string; decisionId: string } | null {
  const match = pathname.match(/^\/planner\/trips\/([^/]+)\/decisions\/([^/]+)$/);
  if (!match) return null;
  return { tripId: match[1], decisionId: match[2] };
}

/** `/planner/u/{username}` exactly. */
export function matchProfilePath(pathname: string): string | null {
  return pathname.match(/^\/planner\/u\/([^/]+)$/)?.[1] ?? null;
}

/** `/planner/share/{token}` exactly. */
export function matchSharePath(pathname: string): string | null {
  return pathname.match(/^\/planner\/share\/([^/]+)$/)?.[1] ?? null;
}

/** `/planner/join/{token}` or `/planner/join/{slug}/{token}` — the token is always the last segment. */
export function matchPlannerJoinPath(pathname: string): string | null {
  const match = pathname.match(/^\/planner\/join\/(.+)$/);
  return match ? lastSegment(match[1]) : null;
}

/** `/j/{token}` or `/j/{slug}/{token}` — the token is always the last segment. */
export function matchJoinLinkPath(pathname: string): string | null {
  const match = pathname.match(/^\/j\/(.+)$/);
  return match ? lastSegment(match[1]) : null;
}

/** Same membership rule as the trip page's own `if (!membership) notFound()`. */
export async function isTripMember(
  admin: SupabaseClient,
  authUserId: string,
  tripId: string
): Promise<boolean> {
  const { data: plannerUser } = await admin
    .from("planner_users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!plannerUser) return false;
  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", plannerUser.id)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(membership);
}

/** A decision that exists, and belongs to the trip in the URL — not just any decision id. */
export async function isValidTripDecision(
  admin: SupabaseClient,
  tripId: string,
  decisionId: string
): Promise<boolean> {
  const { data } = await admin
    .from("planner_decisions")
    .select("id")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .maybeSingle();
  return Boolean(data);
}

export async function tripExists(admin: SupabaseClient, tripId: string): Promise<boolean> {
  const { data } = await admin.from("planner_trips").select("id").eq("id", tripId).maybeSingle();
  return Boolean(data);
}

export async function usernameExists(admin: SupabaseClient, username: string): Promise<boolean> {
  const { data } = await admin
    .from("planner_users")
    .select("id")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return Boolean(data);
}

export async function shareTokenExists(admin: SupabaseClient, token: string): Promise<boolean> {
  const { data } = await admin.from("planner_trips").select("id").eq("share_token", token).maybeSingle();
  return Boolean(data);
}
