import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pre-render existence/membership checks for proxy.ts. These two routes
 * (the trip page, the per-phone invite link) both sit behind a sibling
 * loading.tsx, which means their own notFound() call fires too late to set
 * a real 404 status — the loading fallback has already started streaming a
 * 200 by then (see calendarDate-style comment in loading.js's docs: "Status
 * Codes"). Checking here, before the page renders at all, is the only way
 * to get a correct status for these two without losing the instant loading
 * skeleton. Kept separate from the page's own check, which stays as the
 * real access-control gate — this only decides what status code to send.
 */

/** `/planner/trips/{id}` exactly — not `/planner/trips/new` and not a nested sub-route. */
export function matchTripPagePath(pathname: string): string | null {
  const match = pathname.match(/^\/planner\/trips\/([^/]+)$/);
  if (!match || match[1] === "new") return null;
  return match[1];
}

/** `/j/{token}` or `/j/{slug}/{token}` — the token is always the last segment. */
export function matchJoinLinkPath(pathname: string): string | null {
  const match = pathname.match(/^\/j\/(.+)$/);
  if (!match) return null;
  const parts = match[1].split("/").filter(Boolean);
  return parts[parts.length - 1] ?? null;
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
    .maybeSingle();
  return Boolean(membership);
}
