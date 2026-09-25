import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { notifyTrip } from "@/lib/planner/notify";

/**
 * A day's Plan B. PUT writes (or, with empty text, clears) the alternative;
 * POST { active } switches the day onto it or back, and texts the group
 * either way — the switch is only useful if nobody turns up at the beach.
 */

async function load(tripId: string, dayId: string) {
  const user = await getPlannerUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) } as const;
  const admin = createAdminClient();
  const [{ data: membership }, { data: day }] = await Promise.all([
    admin.from("planner_memberships").select("trip_id").eq("trip_id", tripId).eq("user_id", user.id).eq("status", "active").maybeSingle(),
    admin.from("planner_days").select("*").eq("id", dayId).eq("trip_id", tripId).maybeSingle(),
  ]);
  if (!membership) return { error: NextResponse.json({ error: "Not a member of this trip." }, { status: 403 }) } as const;
  if (!day) return { error: NextResponse.json({ error: "Day not found." }, { status: 404 }) } as const;
  return { admin, day } as const;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { id: tripId, dayId } = await params;
  const loaded = await load(tripId, dayId);
  if ("error" in loaded) return loaded.error;
  const { admin } = loaded;

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 300) : "";
  const when = typeof body.when === "string" ? body.when.trim().slice(0, 60) : "";

  const { data: day, error } = await admin
    .from("planner_days")
    .update(
      text
        ? { plan_b_text: text, plan_b_when: when || null }
        : { plan_b_text: null, plan_b_when: null, plan_b_active: false }
    )
    .eq("id", dayId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ day });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { id: tripId, dayId } = await params;
  const loaded = await load(tripId, dayId);
  if ("error" in loaded) return loaded.error;
  const { admin, day: current } = loaded;

  const body = await request.json().catch(() => ({}));
  const active = body.active === true;
  if (active && !current.plan_b_text) {
    return NextResponse.json({ error: "This day has no Plan B yet." }, { status: 400 });
  }
  if (active === current.plan_b_active) return NextResponse.json({ day: current });

  const { data: day, error } = await admin
    .from("planner_days")
    .update({ plan_b_active: active })
    .eq("id", dayId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: trip } = await admin
    .from("planner_trips")
    .select("id, name, twilio_conversation_sid")
    .eq("id", tripId)
    .maybeSingle();
  if (trip) {
    const weekday = new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
    await notifyTrip(
      admin,
      trip,
      active
        ? `${weekday} is on Plan B${day.plan_b_when ? ` (${day.plan_b_when.toLowerCase()})` : ""}: ${day.plan_b_text}`
        : `${weekday} is back on the original plan.`
    );
  }

  return NextResponse.json({ day });
}
