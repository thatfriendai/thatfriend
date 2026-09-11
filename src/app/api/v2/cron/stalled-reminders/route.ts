import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNudge, type NudgeStage } from "@/lib/planner/nudge";

/**
 * Runs daily (see vercel.json). The automatic version of the manual
 * "Nudge" button: texts only the one person left blocking a stage, and
 * only once per trip per stage (each pass is gated on its own
 * *_reminder_sent_at column being still null, same idempotency pattern
 * as cron/rating-prompts). Trips younger than 48h are skipped so a
 * just-created trip doesn't immediately text its last holdout.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const remindersSent = { availability: 0, preferences: 0 };

  for (const stage of ["availability", "preferences"] as NudgeStage[]) {
    const sentColumn = stage === "availability" ? "availability_reminder_sent_at" : "preferences_reminder_sent_at";
    const marksTable = stage === "availability" ? "planner_availability_marks" : "planner_preferences";

    let query = admin
      .from("planner_trips")
      .select("id, name, twilio_conversation_sid, created_at")
      .lte("created_at", fortyEightHoursAgo)
      .is(sentColumn, null);
    // Only worth reminding about a stage that's still relevant: dates
    // still open for "availability," trip not already over for "preferences."
    query = stage === "availability" ? query.is("dates_locked_at", null) : query.or(`end_date.is.null,end_date.gte.${today}`);
    const { data: candidateTrips } = await query;
    if (!candidateTrips || candidateTrips.length === 0) continue;

    const tripIds = candidateTrips.map((t) => t.id);
    const [{ data: memberRows }, { data: markRows }] = await Promise.all([
      admin.from("planner_memberships").select("trip_id").in("trip_id", tripIds),
      admin.from(marksTable).select("trip_id, user_id").in("trip_id", tripIds),
    ]);
    const totalByTrip = new Map<string, number>();
    for (const r of memberRows ?? []) totalByTrip.set(r.trip_id, (totalByTrip.get(r.trip_id) ?? 0) + 1);
    const answeredByTrip = new Map<string, Set<string>>();
    for (const r of markRows ?? []) {
      const set = answeredByTrip.get(r.trip_id) ?? new Set<string>();
      set.add(r.user_id);
      answeredByTrip.set(r.trip_id, set);
    }

    for (const trip of candidateTrips) {
      const total = totalByTrip.get(trip.id) ?? 0;
      const answered = answeredByTrip.get(trip.id)?.size ?? 0;
      // Exactly one holdout left — the case a nudge actually helps.
      if (total < 2 || answered !== total - 1) continue;

      const result = await sendNudge(admin, trip, stage, "individual");
      if (!("error" in result)) remindersSent[stage]++;
      await admin.from("planner_trips").update({ [sentColumn]: now.toISOString() }).eq("id", trip.id);
    }
  }

  return NextResponse.json(remindersSent);
}
