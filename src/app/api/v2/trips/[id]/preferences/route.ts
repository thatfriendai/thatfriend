import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { BUDGET_FIELDS, INTERESTS, PACE_OPTIONS, type BudgetFieldKey } from "@/lib/planner/preferences";

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

  // Clamped to the same range the sliders offer — a hand-crafted request
  // with a negative or enormous number would otherwise skew the group's
  // overlap math (or overflow the int4 column and 500).
  const toBudget = (key: BudgetFieldKey, v: unknown) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const field = BUDGET_FIELDS.find((f) => f.key === key)!;
    return Math.min(field.max, Math.max(field.min, Math.round(v)));
  };

  const pace =
    typeof body.pace === "string" &&
    PACE_OPTIONS.some((p) => p.key === body.pace)
      ? body.pace
      : null;

  const interests = Array.isArray(body.interests)
    ? body.interests.filter((i: unknown) => typeof i === "string" && INTERESTS.includes(i as (typeof INTERESTS)[number])).slice(0, 3)
    : [];

  const nonNegotiable =
    typeof body.non_negotiable === "string" ? body.non_negotiable.trim().slice(0, 500) : null;

  const { data: pref, error } = await admin
    .from("planner_preferences")
    .upsert(
      {
        trip_id: tripId,
        user_id: user.id,
        stay_max: toBudget("stay_max", body.stay_max),
        flight_max: toBudget("flight_max", body.flight_max),
        food_max: toBudget("food_max", body.food_max),
        pace,
        interests,
        non_negotiable: nonNegotiable || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "trip_id,user_id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ preference: pref });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: pref } = await admin
    .from("planner_preferences")
    .select("*")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ preference: pref ?? null });
}
