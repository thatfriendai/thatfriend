import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { MAX_MARKS, sanitizeMarkDates, todayIn } from "@/lib/planner/calendarDate";

export async function PUT(
  request: Request,
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

  const body = await request.json().catch(() => ({}));
  const dates = sanitizeMarkDates(body.dates, todayIn());
  if (!dates) {
    return NextResponse.json({ error: `You can mark at most ${MAX_MARKS} days.` }, { status: 400 });
  }

  // Write the new set before removing anything, so a failed write leaves
  // the person's previous marks intact instead of wiping them. The primary
  // key (trip_id, user_id, date) makes re-inserting a kept day a no-op.
  if (dates.length > 0) {
    const rows = dates.map((date) => ({ trip_id: tripId, user_id: user.id, date }));
    const { error } = await admin
      .from("planner_availability_marks")
      .upsert(rows, { onConflict: "trip_id,user_id,date", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Then drop whatever they un-marked.
  let removal = admin
    .from("planner_availability_marks")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", user.id);
  if (dates.length > 0) removal = removal.not("date", "in", `(${dates.join(",")})`);
  const { error: deleteError } = await removal;
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ dates });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("planner_availability_marks")
    .select("date")
    .eq("trip_id", tripId)
    .eq("user_id", user.id);

  return NextResponse.json({ dates: (data ?? []).map((d) => d.date) });
}
