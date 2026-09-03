import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { addParticipantToConversation } from "@/lib/twilio/conversations";
import { toE164 } from "@/lib/planner/phone";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token = searchParams.get("token");
  const name = searchParams.get("name");
  const waOptIn = searchParams.get("wa") === "1";

  if (!code) {
    return NextResponse.redirect(`${origin}/planner/login?error=Could not sign in`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/planner/login?error=Could not sign in`);
  }

  const plannerUser = await getPlannerUser();
  if (!plannerUser) {
    return NextResponse.redirect(`${origin}/planner/login?error=Could not sign in`);
  }

  const admin = createAdminClient();

  if ((name && !plannerUser.name) || waOptIn) {
    await admin
      .from("planner_users")
      .update({
        ...(name && !plannerUser.name ? { name } : {}),
        ...(waOptIn ? { whatsapp_opt_in: true } : {}),
      })
      .eq("id", plannerUser.id);
  }

  if (token) {
    const { data: invite } = await admin
      .from("planner_invites")
      .select("id, trip_id")
      .eq("token", token)
      .maybeSingle();

    if (invite) {
      await admin
        .from("planner_memberships")
        .upsert(
          { trip_id: invite.trip_id, user_id: plannerUser.id, role: "member" },
          { onConflict: "trip_id,user_id", ignoreDuplicates: true }
        );
      await admin
        .from("planner_invites")
        .update({ accepted_by: plannerUser.id })
        .eq("id", invite.id);

      if (plannerUser.phone) {
        const { data: invitedTrip } = await admin
          .from("planner_trips")
          .select("twilio_conversation_sid")
          .eq("id", invite.trip_id)
          .maybeSingle();
        if (invitedTrip?.twilio_conversation_sid) {
          await addParticipantToConversation(
            invitedTrip.twilio_conversation_sid,
            toE164(plannerUser.phone)
          ).catch(() => {
            // Best-effort — they can still be synced into the group thread later.
          });
        }
      }

      return NextResponse.redirect(`${origin}/planner/trips/${invite.trip_id}/preferences`);
    }
  }

  return NextResponse.redirect(`${origin}/planner/trips`);
}
