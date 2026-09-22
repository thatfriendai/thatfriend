import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadDatesView } from "@/lib/planner/datesView";

const FAILURES = {
  unauthenticated: { error: "Not signed in.", status: 401 },
  not_member: { error: "Not a member of this trip.", status: 403 },
  not_found: { error: "Trip not found.", status: 404 },
} as const;

/** Feeds the Dates modal on the trip page — same loader the standalone /dates page renders from. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const result = await loadDatesView(createAdminClient(), tripId);
  if (result.status !== "ok") {
    const failure = FAILURES[result.status];
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json(result.payload);
}
