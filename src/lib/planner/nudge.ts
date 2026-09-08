import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSmsText } from "@/lib/twilio/send";
import { getOrCreateTripConversation, sendConversationMessage } from "@/lib/twilio/conversations";
import { toE164 } from "./phone";

export type NudgeStage = "availability" | "preferences";
export type NudgeMode = "group" | "individual";

/**
 * Nudges trip members who haven't answered a stage yet — shared by the web
 * "Nudge" button (src/app/api/v2/trips/[id]/nudge/route.ts) and the
 * text-triggered version so there's one place that knows who's pending.
 */
export async function sendNudge(
  admin: SupabaseClient,
  trip: { id: string; name: string; twilio_conversation_sid: string | null },
  stage: NudgeStage,
  mode: NudgeMode
): Promise<{ sentCount: number } | { error: string }> {
  const { data: members } = await admin
    .from("planner_memberships")
    .select("planner_users(id, name, phone)")
    .eq("trip_id", trip.id);

  const nudgeable = (members ?? [])
    .map(
      (m) =>
        m.planner_users as unknown as {
          id: string;
          name: string | null;
          phone: string | null;
        } | null
    )
    .filter((m): m is NonNullable<typeof m> => Boolean(m?.phone));

  if (nudgeable.length === 0) {
    return { error: "Nobody on this trip has a phone number connected yet." };
  }

  const { data: answered } = await admin
    .from(stage === "availability" ? "planner_availability_marks" : "planner_preferences")
    .select("user_id")
    .eq("trip_id", trip.id);
  const answeredIds = new Set((answered ?? []).map((p) => p.user_id));

  const toNudge = nudgeable.filter((m) => !answeredIds.has(m.id));
  if (toNudge.length === 0) {
    return { error: "Everyone with a phone connected has already answered." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const link =
    stage === "availability"
      ? `${siteUrl}/planner/trips/${trip.id}/dates`
      : `${siteUrl}/planner/trips/${trip.id}/preferences`;
  const what = stage === "availability" ? "your dates" : "your preferences";

  if (mode === "group") {
    try {
      const conversationSid = await getOrCreateTripConversation(admin, trip);
      const names = toNudge.map((m) => m.name?.split(" ")[0] || "someone").join(", ");
      await sendConversationMessage(
        conversationSid,
        `Still waiting on ${what} from ${names} for "${trip.name}". Answer here: ${link}`
      );
      return { sentCount: 1 };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not send the group nudge." };
    }
  }

  let sentCount = 0;
  for (const member of toNudge) {
    try {
      const namePart = member.name ? ` ${member.name.split(" ")[0]}` : "";
      await sendSmsText(
        toE164(member.phone as string),
        `Hey${namePart}! "${trip.name}" still needs ${what}. Answer here: ${link}`
      );
      sentCount++;
    } catch {
      // Best-effort — keep nudging the rest even if one send fails.
    }
  }

  return { sentCount };
}
