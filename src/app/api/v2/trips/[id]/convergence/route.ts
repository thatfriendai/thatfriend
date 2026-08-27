import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { BUDGET_FIELDS } from "@/lib/planner/preferences";
import { computeOverlap, computeClusters } from "@/lib/planner/convergence";
import { generateConvergenceReads } from "@/lib/planner/narrative";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
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

  const { data: trip } = await admin
    .from("planner_trips")
    .select("name, privacy")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  const { count: total } = await admin
    .from("planner_memberships")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId);

  const { data: prefs } = await admin
    .from("planner_preferences")
    .select("*, planner_users(id, name, email)")
    .eq("trip_id", tripId);

  const rows = prefs ?? [];
  const isPrivate = trip.privacy === "private";

  const overlaps = BUDGET_FIELDS.map((field) => {
    const entries = rows
      .filter((r) => typeof r[field.key] === "number")
      .map((r) => {
        const person = r.planner_users as unknown as { id: string; name: string | null; email: string | null } | null;
        return {
          value: r[field.key] as number,
          userId: isPrivate ? null : (person?.id ?? null),
          name: isPrivate ? null : person?.name || person?.email?.split("@")[0] || null,
        };
      });
    return computeOverlap(field.key, field.label, field.max, entries);
  }).filter((o) => o !== null);

  const clusters = computeClusters(
    rows.map((r) => (r.interests as string[]) ?? []),
    rows.length
  );

  const nonNegotiables = rows
    .map((r) => r.non_negotiable as string | null)
    .filter((n): n is string => Boolean(n));

  let reads: Awaited<ReturnType<typeof generateConvergenceReads>> = [];
  if (overlaps.length > 0) {
    try {
      reads = await generateConvergenceReads(trip.name, overlaps, clusters, nonNegotiables);
    } catch {
      // Convergence numbers still stand without the narrative reads.
      reads = [];
    }
  }

  return NextResponse.json({
    answered: rows.length,
    total: total ?? 0,
    privacy: trip.privacy,
    overlaps,
    clusters,
    reads,
  });
}
