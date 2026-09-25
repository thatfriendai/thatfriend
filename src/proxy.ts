import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveInviteToken } from "@/lib/planner/joinLink";
import {
  matchTripPagePath,
  matchTripSubRoutePath,
  matchTripDecisionPath,
  matchProfilePath,
  matchSharePath,
  matchPlannerJoinPath,
  matchJoinLinkPath,
  isTripMember,
  isValidTripDecision,
  tripExists,
  usernameExists,
  shareTokenExists,
} from "@/lib/planner/proxyGuards";

// A path that resolves to nothing in this app — rewriting to a genuinely
// unmatched route (rather than throwing notFound() inside the page) is
// what lets Next.js set a real 404 status instead of a 200 with 404
// content: see proxyGuards.ts for why the page's own notFound() can't.
const NOT_FOUND_PATH = "/__not_found__";

function notFoundResponse(request: NextRequest) {
  return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url), { status: 404 });
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const admin = createAdminClient();

  const tripId = matchTripPagePath(pathname);
  if (tripId && user) {
    if (!(await isTripMember(admin, user.id, tripId))) return notFoundResponse(request);
  }

  // preferences/dates/convergence/reviews — same membership gate as the
  // trip page itself. A signed-out visitor still gets the page's own
  // redirect-to-login, not a 404: only checked once there's a user.
  const subRouteTripId = matchTripSubRoutePath(pathname);
  if (subRouteTripId && user) {
    if (!(await isTripMember(admin, user.id, subRouteTripId))) return notFoundResponse(request);
  }

  const decisionMatch = matchTripDecisionPath(pathname);
  if (decisionMatch && user) {
    const member = await isTripMember(admin, user.id, decisionMatch.tripId);
    if (!member) return notFoundResponse(request);
    if (!(await isValidTripDecision(admin, decisionMatch.tripId, decisionMatch.decisionId))) {
      return notFoundResponse(request);
    }
  }

  // A private profile isn't a 404 — the page renders its own "this profile
  // is private" message for that. Only a genuinely missing username 404s.
  const username = matchProfilePath(pathname);
  if (username) {
    if (!(await usernameExists(admin, username))) return notFoundResponse(request);
  }

  const shareToken = matchSharePath(pathname);
  if (shareToken) {
    if (!(await shareTokenExists(admin, shareToken))) return notFoundResponse(request);
  }

  // Unlike /j/<token> (per-phone only), /planner/join/<token> accepts
  // either invite type — the trip-wide share link lands here too.
  const plannerJoinToken = matchPlannerJoinPath(pathname);
  if (plannerJoinToken) {
    const invite = await resolveInviteToken(admin, plannerJoinToken);
    if (!invite || !(await tripExists(admin, invite.tripId))) return notFoundResponse(request);
  }

  const joinToken = matchJoinLinkPath(pathname);
  if (joinToken) {
    const invite = await resolveInviteToken(admin, joinToken);
    if (!invite || invite.source !== "phone") return notFoundResponse(request);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image optimization,
     * so the organizer's session cookie stays fresh everywhere else.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
