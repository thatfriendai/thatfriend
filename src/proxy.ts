import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveInviteToken } from "@/lib/planner/joinLink";
import { matchTripPagePath, matchJoinLinkPath, isTripMember } from "@/lib/planner/proxyGuards";

// A path that resolves to nothing in this app — routing this a genuinely
// unmatched route (rather than throwing notFound() inside the page) is
// what lets Next.js set a real 404 status instead of a 200 with 404
// content: see proxyGuards.ts for why the page's own notFound() can't.
const NOT_FOUND_PATH = "/__not_found__";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const tripId = matchTripPagePath(pathname);
  if (tripId && user) {
    const member = await isTripMember(createAdminClient(), user.id, tripId);
    if (!member) return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url), { status: 404 });
  }

  const joinToken = matchJoinLinkPath(pathname);
  if (joinToken) {
    const invite = await resolveInviteToken(createAdminClient(), joinToken);
    if (!invite || invite.source !== "phone") {
      return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url), { status: 404 });
    }
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
