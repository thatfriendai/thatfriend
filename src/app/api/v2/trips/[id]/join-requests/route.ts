import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { notifyUser } from "@/lib/planner/notify";

/**
 * "Ask to join" on someone's public upcoming trip. Owner-side accept/
 * decline lives on the trip page itself (see PlannerTripPage), not a
 * separate inbox screen.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: trip } = await admin
    .from("planner_trips")
    .select("id, name, is_public, created_by")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  if (!trip.is_public) return NextResponse.json({ error: "This trip isn't public." }, { status: 403 });

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membership) return NextResponse.json({ error: "You're already on this trip." }, { status: 400 });

  // The upsert below would reset any existing request to pending and
  // re-notify the owner — a declined request must stay declined, or
  // re-asking becomes a way to ping the owner over and over.
  const { data: existingRequest } = await admin
    .from("planner_join_requests")
    .select("status")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingRequest?.status === "declined") {
    return NextResponse.json({ error: "The organizer already passed on this request." }, { status: 409 });
  }
  // Already asked and still waiting — nothing new to tell the owner.
  if (existingRequest?.status === "pending") return NextResponse.json({ ok: true });

  const { error } = await admin
    .from("planner_join_requests")
    .upsert(
      { trip_id: tripId, user_id: user.id, status: "pending" },
      { onConflict: "trip_id,user_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (trip.created_by) {
    const firstName = (user.name || "Someone").split(/\s+/)[0];
    await notifyUser(admin, trip.created_by, `${firstName} wants to join "${trip.name}".`);
  }

  return NextResponse.json({ ok: true });
}
