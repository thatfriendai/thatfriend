import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { acceptInviteToken, resolveInviteToken } from "@/lib/planner/joinLink";

/** Trip preview for an invite token — either kind (see resolveInviteToken). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const invite = await resolveInviteToken(admin, token);
  if (!invite) {
    return NextResponse.json({ error: "This invite link isn't valid." }, { status: 404 });
  }

  const { data: trip } = await admin
    .from("planner_trips")
    .select("id, name, destination, start_date, end_date, occasion")
    .eq("id", invite.tripId)
    .maybeSingle();

  if (!trip) {
    return NextResponse.json({ error: "This trip no longer exists." }, { status: 404 });
  }

  return NextResponse.json({ trip });
}

/**
 * "Join <trip>" for someone who's already signed in — the tap itself is the
 * join and the consent (see acceptInviteToken). Anyone not signed in goes
 * through phone sign-in with the token instead, and verify-phone accepts it
 * there.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const result = await acceptInviteToken(admin, user, token);
  if (result.outcome === "not_found") return NextResponse.json({ error: "That invite isn't valid anymore." }, { status: 404 });
  if (result.outcome === "wrong_phone") {
    return NextResponse.json(
      { error: "This invite was texted to a different number. Ask whoever invited you for the trip's share link." },
      { status: 403 }
    );
  }
  if (result.outcome === "error") return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ tripId: result.tripId, outcome: result.outcome, redirect: `/planner/trips/${result.tripId}` });
}
