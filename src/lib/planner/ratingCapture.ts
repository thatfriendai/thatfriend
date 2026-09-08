import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSmsText } from "@/lib/twilio/send";
import { getOrCreateTripConversation, sendConversationMessage } from "@/lib/twilio/conversations";
import { toE164 } from "./phone";

export interface VisitedPlace {
  id: string;
  name: string;
  photoUrl: string | null;
  dayLabel: string | null;
}

/**
 * The rating-capture queue: every Visit for this trip (a Place attached to
 * a Day), in itinerary order — day date first, then a stable created_at
 * tiebreaker within the day, since places don't carry their own
 * within-day position. Used by both the capture UI and (indirectly) by
 * "only rated places travel to future trips" in the copy-trip route.
 */
export async function listVisits(admin: SupabaseClient, tripId: string): Promise<VisitedPlace[]> {
  const { data: places } = await admin
    .from("planner_places")
    .select("id, name, photo_url, day_id, created_at, planner_days(date)")
    .eq("trip_id", tripId)
    .not("day_id", "is", null)
    .order("created_at", { ascending: true });

  const rows = (places ?? [])
    .map((p) => {
      const day = p.planner_days as unknown as { date: string } | null;
      return {
        id: p.id as string,
        name: p.name as string,
        photoUrl: p.photo_url as string | null,
        date: day?.date ?? null,
        createdAt: p.created_at as string,
      };
    })
    .sort((a, b) => {
      if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    photoUrl: r.photoUrl,
    dayLabel: r.date
      ? new Date(r.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
      : null,
  }));
}

/**
 * Texts every phone-verified member of a trip to go rate the places from
 * it — the 2b "existing nudge slot," using the exact same send mechanism
 * as a manual nudge (individual SMS per member, or one group message when
 * the trip already has a Conversation), just with different copy and a
 * time-based trigger instead of a button. Best-effort per recipient, like
 * every other bulk send in this codebase.
 */
export async function sendRatingPrompt(
  admin: SupabaseClient,
  trip: { id: string; name: string; twilio_conversation_sid: string | null },
  kind: "first" | "reminder"
): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const link = `${siteUrl}/planner/trips/${trip.id}/reviews`;
  const message =
    kind === "first"
      ? `"${trip.name}" wrapped a few days ago — rate a few places while it's fresh: ${link}`
      : `Last call to rate places from "${trip.name}": ${link}`;

  if (trip.twilio_conversation_sid) {
    try {
      const conversationSid = await getOrCreateTripConversation(admin, trip);
      await sendConversationMessage(conversationSid, message);
      return;
    } catch {
      // Fall through to individual sends if the group message fails.
    }
  }

  const { data: members } = await admin
    .from("planner_memberships")
    .select("planner_users(phone)")
    .eq("trip_id", trip.id);
  const phones = (members ?? [])
    .map((m) => (m.planner_users as unknown as { phone: string | null } | null)?.phone)
    .filter((p): p is string => Boolean(p));

  for (const phone of phones) {
    try {
      await sendSmsText(toE164(phone), message);
    } catch {
      // Best-effort — keep going for the rest.
    }
  }
}
