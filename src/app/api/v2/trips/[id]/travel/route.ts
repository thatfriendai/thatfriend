import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

/** Your own arrival or departure: PUT { direction, detail, date, time } upserts it, DELETE { direction } removes it. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function member(tripId: string) {
  const user = await getPlannerUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) } as const;
  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return { error: NextResponse.json({ error: "Not a member of this trip." }, { status: 403 }) } as const;
  return { user, admin } as const;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const check = await member(tripId);
  if ("error" in check) return check.error;
  const { user, admin } = check;

  const body = await request.json().catch(() => ({}));
  const direction = body.direction === "arrive" || body.direction === "depart" ? body.direction : null;
  const detail = typeof body.detail === "string" ? body.detail.trim().slice(0, 120) : "";
  const date = typeof body.date === "string" && DATE_RE.test(body.date) ? body.date : null;
  const time = typeof body.time === "string" && TIME_RE.test(body.time) ? body.time : null;
  if (!direction || !detail || !date || !time) {
    return NextResponse.json({ error: "Add how you're travelling, the day and the time." }, { status: 400 });
  }

  const { data: leg, error } = await admin
    .from("planner_travel_legs")
    .upsert({ trip_id: tripId, user_id: user.id, direction, detail, date, time }, { onConflict: "trip_id,user_id,direction" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leg });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const check = await member(tripId);
  if ("error" in check) return check.error;
  const { user, admin } = check;

  const body = await request.json().catch(() => ({}));
  const direction = body.direction === "arrive" || body.direction === "depart" ? body.direction : null;
  if (!direction) return NextResponse.json({ error: "direction is required." }, { status: 400 });

  const { error } = await admin
    .from("planner_travel_legs")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .eq("direction", direction);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
