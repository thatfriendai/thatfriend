import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { sendWhatsAppText } from "@/lib/meta/client";
import { normalizePhoneDigits } from "@/lib/planner/phone";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const stage = body.stage === "availability" ? "availability" : "preferences";

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
    .select("name")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  const { data: members } = await admin
    .from("planner_memberships")
    .select("planner_users(id, name, phone, whatsapp_opt_in)")
    .eq("trip_id", tripId);

  const nudgeable = (members ?? [])
    .map(
      (m) =>
        m.planner_users as unknown as {
          id: string;
          name: string | null;
          phone: string | null;
          whatsapp_opt_in: boolean;
        } | null
    )
    .filter((m): m is NonNullable<typeof m> => Boolean(m?.phone && m.whatsapp_opt_in));

  if (nudgeable.length === 0) {
    return NextResponse.json({ error: "Nobody on this trip has WhatsApp connected yet." });
  }

  const { data: answered } = await admin
    .from(stage === "availability" ? "planner_availability_marks" : "planner_preferences")
    .select("user_id")
    .eq("trip_id", tripId);
  const answeredIds = new Set((answered ?? []).map((p) => p.user_id));

  const toNudge = nudgeable.filter((m) => !answeredIds.has(m.id));
  if (toNudge.length === 0) {
    return NextResponse.json({ error: "Everyone with WhatsApp connected has already answered." });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const message =
    stage === "availability"
      ? (name: string) =>
          `Hey${name}! "${trip.name}" needs your dates — mark every day that could work: ${siteUrl}/planner/trips/${tripId}/dates`
      : (name: string) =>
          `Hey${name}! Still need your preferences for "${trip.name}" — budget, pace, and the one thing you wouldn't compromise on. Answer here: ${siteUrl}/planner/trips/${tripId}/preferences`;

  let sentCount = 0;
  for (const member of toNudge) {
    try {
      await sendWhatsAppText(
        normalizePhoneDigits(member.phone as string),
        message(member.name ? ` ${member.name.split(" ")[0]}` : "")
      );
      sentCount++;
    } catch {
      // Best-effort — keep nudging the rest even if one send fails.
    }
  }

  return NextResponse.json({ sentCount });
}
