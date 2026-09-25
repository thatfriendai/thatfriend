import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { DATE_FLAG_REASONS, type DateFlagReason } from "@/lib/supabase/planner-types";

export async function POST(
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
    .eq("status", "active")
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
  const reason: DateFlagReason | null = DATE_FLAG_REASONS.includes(body.reason) ? body.reason : null;

  const { data: trip, error } = await admin
    .from("planner_trips")
    .update({
      dates_flagged_by: user.id,
      dates_flagged_at: new Date().toISOString(),
      dates_flag_note: note || null,
      dates_flag_reason: reason,
    })
    .eq("id", tripId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ trip });
}
