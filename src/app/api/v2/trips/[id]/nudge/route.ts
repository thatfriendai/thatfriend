import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { sendSmsText } from "@/lib/twilio/send";
import { getOrCreateTripConversation, sendConversationMessage } from "@/lib/twilio/conversations";
import { toE164 } from "@/lib/planner/phone";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const stage = body.stage === "availability" ? "availability" : "preferences";
  const mode = body.mode === "group" ? "group" : "individual";

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

  const { data: trip } = await admin
    .from("planner_trips")
    .select("id, name, twilio_conversation_sid")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  const { data: members } = await admin
    .from("planner_memberships")
    .select("planner_users(id, name, phone)")
    .eq("trip_id", tripId);

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
    return NextResponse.json({ error: "Nobody on this trip has a phone number connected yet." });
  }

  const { data: answered } = await admin
    .from(stage === "availability" ? "planner_availability_marks" : "planner_preferences")
    .select("user_id")
    .eq("trip_id", tripId);
  const answeredIds = new Set((answered ?? []).map((p) => p.user_id));

  const toNudge = nudgeable.filter((m) => !answeredIds.has(m.id));
  if (toNudge.length === 0) {
    return NextResponse.json({ error: "Everyone with a phone connected has already answered." });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const link =
    stage === "availability"
      ? `${siteUrl}/planner/trips/${tripId}/dates`
      : `${siteUrl}/planner/trips/${tripId}/preferences`;
  const what = stage === "availability" ? "your dates" : "your preferences";

  if (mode === "group") {
    try {
      const conversationSid = await getOrCreateTripConversation(admin, trip);
      const names = toNudge.map((m) => m.name?.split(" ")[0] || "someone").join(", ");
      await sendConversationMessage(
        conversationSid,
        `Still waiting on ${what} from ${names} for "${trip.name}". Answer here: ${link}`
      );
      return NextResponse.json({ sentCount: 1 });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not send the group nudge." },
        { status: 502 }
      );
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

  return NextResponse.json({ sentCount });
}
