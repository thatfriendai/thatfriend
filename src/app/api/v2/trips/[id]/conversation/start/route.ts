import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { getOrCreateTripConversation, sendConversationMessage } from "@/lib/twilio/conversations";
import { getSmsFrom } from "@/lib/twilio/client";

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

  const alreadyStarted = Boolean(trip.twilio_conversation_sid);

  try {
    const conversationSid = await getOrCreateTripConversation(admin, trip);
    if (!alreadyStarted) {
      await sendConversationMessage(
        conversationSid,
        `That Friend's here for "${trip.name}" — forward links, notes, or screenshots and they'll land on the map.`
      );
    }
    return NextResponse.json({ conversationSid, number: getSmsFrom() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start the group text." },
      { status: 502 }
    );
  }
}
