import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

/**
 * The pinned Essentials card — address, door code, Wi-Fi, host. Any member
 * can add, edit or remove a field: whoever booked the place is rarely the
 * one who gets asked for the code at midnight.
 */

function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

async function memberCheck(tripId: string) {
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
  const check = await memberCheck(tripId);
  if ("error" in check) return check.error;
  const { user, admin } = check;

  const body = await request.json().catch(() => ({}));
  const label = clean(body.label, 60);
  const value = clean(body.value, 200);
  if (!label || !value) return NextResponse.json({ error: "A label and a value are both needed." }, { status: 400 });

  const { count } = await admin
    .from("planner_trip_essentials")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId);

  const { data: essential, error } = await admin
    .from("planner_trip_essentials")
    .insert({
      trip_id: tripId,
      stay: clean(body.stay, 60),
      label,
      value,
      sub: clean(body.sub, 200),
      position: count ?? 0,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ essential });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const check = await memberCheck(tripId);
  if ("error" in check) return check.error;
  const { admin } = check;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  const label = clean(body.label, 60);
  const value = clean(body.value, 200);
  if (!id || !label || !value) return NextResponse.json({ error: "A label and a value are both needed." }, { status: 400 });

  const { data: essential, error } = await admin
    .from("planner_trip_essentials")
    .update({ label, value, sub: clean(body.sub, 200), stay: clean(body.stay, 60) })
    .eq("id", id)
    .eq("trip_id", tripId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!essential) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ essential });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const check = await memberCheck(tripId);
  if ("error" in check) return check.error;
  const { admin } = check;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const { error } = await admin.from("planner_trip_essentials").delete().eq("id", id).eq("trip_id", tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
