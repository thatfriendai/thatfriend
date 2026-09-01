import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import type { PaceFeedback } from "@/lib/supabase/planner-types";

const PACE_FEEDBACK_OPTIONS: PaceFeedback[] = [
  "saw_everything",
  "about_right",
  "not_enough_time",
  "too_packed",
];

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
  const stayRating =
    typeof body.stay_rating === "number" && Number.isFinite(body.stay_rating)
      ? Math.min(5, Math.max(1, Math.round(body.stay_rating)))
      : null;
  const paceFeedback =
    typeof body.pace_feedback === "string" &&
    PACE_FEEDBACK_OPTIONS.includes(body.pace_feedback as PaceFeedback)
      ? (body.pace_feedback as PaceFeedback)
      : null;

  const { data: review, error } = await admin
    .from("planner_trip_reviews")
    .upsert(
      { trip_id: tripId, user_id: user.id, stay_rating: stayRating, pace_feedback: paceFeedback },
      { onConflict: "trip_id,user_id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ review });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: review } = await admin
    .from("planner_trip_reviews")
    .select("*")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ review: review ?? null });
}
