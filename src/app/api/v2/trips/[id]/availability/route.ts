import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  const dates = Array.isArray(body.dates)
    ? [...new Set(body.dates.filter((d: unknown) => typeof d === "string" && DATE_RE.test(d)))]
    : [];

  await admin
    .from("planner_availability_marks")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", user.id);

  if (dates.length > 0) {
    const rows = dates.map((date) => ({ trip_id: tripId, user_id: user.id, date }));
    const { error } = await admin.from("planner_availability_marks").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
