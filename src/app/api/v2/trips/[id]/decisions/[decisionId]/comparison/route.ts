import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { buildStayComparison } from "@/lib/planner/stayComparison";
import { generateStayRead } from "@/lib/planner/stayNarrative";

/**
 * Owns all the derived math for a 'stay' decision (per-person-per-night,
 * best-in-row, walk time to saved places) so the client never recomputes
 * it — see src/lib/planner/stayComparison.ts.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; decisionId: string }> }
) {
  const { id: tripId, decisionId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }

  const { data: decision } = await admin
    .from("planner_decisions")
    .select("id, title, kind, nights, party_size")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });
  if (decision.kind !== "stay") {
    return NextResponse.json({ error: "This isn't an accommodation decision." }, { status: 400 });
  }

  const { count: memberCount } = await admin
    .from("planner_memberships")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);

  const partySize = decision.party_size ?? memberCount ?? 1;
  const comparison = await buildStayComparison(admin, tripId, decisionId, decision.nights, partySize);
  const read = await generateStayRead(decision.title, comparison);

  return NextResponse.json({ ...comparison, read });
}
