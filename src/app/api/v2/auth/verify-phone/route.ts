import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionForPhone } from "@/lib/planner/phoneSession";
import { addParticipantToConversation } from "@/lib/twilio/conversations";
import { toE164 } from "@/lib/planner/phone";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!phone || !code) {
    return NextResponse.json({ error: "Phone and code are required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: codeRow } = await admin
    .from("planner_whatsapp_codes")
    .select("*")
    .eq("phone", phone)
    .eq("code", code)
    .maybeSingle();

  if (!codeRow || new Date(codeRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "That code is wrong or has expired." }, { status: 400 });
  }

  await admin.from("planner_whatsapp_codes").delete().eq("id", codeRow.id);

  const { data: existing } = await admin
    .from("planner_users")
    .select("id, name")
    .eq("phone", phone)
    .maybeSingle();

  let plannerUserId: string;
  if (existing) {
    plannerUserId = existing.id;
    if (codeRow.name && !existing.name) {
      await admin.from("planner_users").update({ name: codeRow.name }).eq("id", existing.id);
    }
  } else {
    const { data: created, error: createError } = await admin
      .from("planner_users")
      .insert({ phone, name: codeRow.name, whatsapp_opt_in: true })
      .select("id")
      .single();
    if (createError || !created) {
      return NextResponse.json(
        { error: createError?.message ?? "Could not create your account." },
        { status: 500 }
      );
    }
    plannerUserId = created.id;
  }

  const session = await createSessionForPhone(admin, phone);
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: 500 });
  }

  if (codeRow.invite_token) {
    const { data: invite } = await admin
      .from("planner_invites")
      .select("id, trip_id")
      .eq("token", codeRow.invite_token)
      .maybeSingle();

    if (invite) {
      await admin
        .from("planner_memberships")
        .upsert(
          { trip_id: invite.trip_id, user_id: plannerUserId, role: "member" },
          { onConflict: "trip_id,user_id", ignoreDuplicates: true }
        );
      await admin.from("planner_invites").update({ accepted_by: plannerUserId }).eq("id", invite.id);

      const { data: invitedTrip } = await admin
        .from("planner_trips")
        .select("twilio_conversation_sid")
        .eq("id", invite.trip_id)
        .maybeSingle();
      if (invitedTrip?.twilio_conversation_sid) {
        await addParticipantToConversation(invitedTrip.twilio_conversation_sid, toE164(phone)).catch(
          () => {
            // Best-effort — they can still be synced into the group thread later.
          }
        );
      }

      return NextResponse.json({ redirect: `/planner/trips/${invite.trip_id}/preferences` });
    }
  }

  return NextResponse.json({ redirect: "/planner/trips" });
}
