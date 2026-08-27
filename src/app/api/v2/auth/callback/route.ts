import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token = searchParams.get("token");

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

  if (token) {
    const admin = createAdminClient();
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

      return NextResponse.redirect(`${origin}/planner/trips/${invite.trip_id}`);
    }
  }

  return NextResponse.redirect(`${origin}/planner/trips`);
}
