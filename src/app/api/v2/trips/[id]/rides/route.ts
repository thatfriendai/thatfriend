import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

/** Ride groups under the arrivals/departures cards. Any member can tag or remove one. */

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
    .maybeSingle();
  if (!membership) return { error: NextResponse.json({ error: "Not a member of this trip." }, { status: 403 }) } as const;
  return { user, admin } as const;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const check = await member(tripId);
  if ("error" in check) return check.error;
  const { user, admin } = check;

  const body = await request.json().catch(() => ({}));
  const direction = body.direction === "arrive" || body.direction === "depart" ? body.direction : null;
  const time = typeof body.time === "string" && TIME_RE.test(body.time) ? body.time : null;
  const requested: string[] = Array.isArray(body.member_ids)
    ? body.member_ids.filter((m: unknown): m is string => typeof m === "string")
    : [];
  if (!direction || requested.length < 2) {
    return NextResponse.json({ error: "Pick at least two people." }, { status: 400 });
  }

  // Only people actually on the trip can ride in one of its groups.
  const { data: members } = await admin
    .from("planner_memberships")
    .select("user_id")
    .eq("trip_id", tripId)
    .in("user_id", requested);
  const memberIds = (members ?? []).map((m) => m.user_id as string);
  if (memberIds.length < 2) return NextResponse.json({ error: "Pick at least two people." }, { status: 400 });

  const { data: ride, error } = await admin
    .from("planner_ride_groups")
    .insert({ trip_id: tripId, direction, member_ids: memberIds, time, created_by: user.id })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ride });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const check = await member(tripId);
  if ("error" in check) return check.error;
  const { admin } = check;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const { error } = await admin.from("planner_ride_groups").delete().eq("id", id).eq("trip_id", tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
