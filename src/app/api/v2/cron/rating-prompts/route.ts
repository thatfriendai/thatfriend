import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRatingPrompt } from "@/lib/planner/ratingCapture";

/**
 * Runs daily (see vercel.json). Two independent, idempotent passes — a
 * trip can only ever get caught by each one once, since both check the
 * timestamp column they're about to set is still null.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

  const { data: needFirst } = await admin
    .from("planner_trips")
    .select("id, name, twilio_conversation_sid")
    .not("end_date", "is", null)
    .lte("end_date", threeDaysAgo)
    .is("rating_prompt_sent_at", null);

  for (const trip of needFirst ?? []) {
    await sendRatingPrompt(admin, trip, "first");
    await admin.from("planner_trips").update({ rating_prompt_sent_at: now.toISOString() }).eq("id", trip.id);
  }

  const { data: needReminder } = await admin
    .from("planner_trips")
    .select("id, name, twilio_conversation_sid")
    .not("rating_prompt_sent_at", "is", null)
    .lte("rating_prompt_sent_at", sevenDaysAgo)
    .is("rating_reminder_sent_at", null);

  for (const trip of needReminder ?? []) {
    await sendRatingPrompt(admin, trip, "reminder");
    await admin.from("planner_trips").update({ rating_reminder_sent_at: now.toISOString() }).eq("id", trip.id);
  }

  return NextResponse.json({
    firstSent: needFirst?.length ?? 0,
    remindersSent: needReminder?.length ?? 0,
  });
}
