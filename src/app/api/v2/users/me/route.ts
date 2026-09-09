import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPlannerUser } from "@/lib/planner/session";

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const DIGEST_FREQUENCIES = ["instant", "daily", "weekly", "urgent"];

export async function PATCH(request: Request) {
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();
  const update: Record<string, string | boolean | null> = {};

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    update.name = trimmed;
  }

  if (typeof body.avatar_url === "string" || body.avatar_url === null) {
    update.avatar_url = body.avatar_url;
  }

  if (typeof body.whatsapp_opt_in === "boolean") {
    update.whatsapp_opt_in = body.whatsapp_opt_in;
  }

  if (typeof body.notify_sms === "boolean") update.notify_sms = body.notify_sms;
  if (typeof body.notify_email === "boolean") update.notify_email = body.notify_email;
  if (typeof body.notify_inapp === "boolean") update.notify_inapp = body.notify_inapp;
  if (typeof body.default_trip_public === "boolean") update.default_trip_public = body.default_trip_public;

  if (typeof body.digest_frequency === "string") {
    if (!DIGEST_FREQUENCIES.includes(body.digest_frequency)) {
      return NextResponse.json({ error: "Unknown digest frequency." }, { status: 400 });
    }
    update.digest_frequency = body.digest_frequency;
  }

  if (typeof body.username === "string") {
    const username = body.username.trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: "Usernames are 3-30 characters: lowercase letters, numbers, and hyphens." },
        { status: 400 }
      );
    }
    const { data: taken } = await admin
      .from("planner_users")
      .select("id")
      .eq("username", username)
      .neq("id", user.id)
      .maybeSingle();
    if (taken) return NextResponse.json({ error: "That username is taken." }, { status: 400 });
    update.username = username;
  }

  if (typeof body.tagline === "string") {
    update.tagline = body.tagline.trim().slice(0, 160) || null;
  }

  if (typeof body.location === "string") {
    update.location = body.location.trim().slice(0, 60) || null;
  }

  if (typeof body.is_public === "boolean") {
    update.is_public = body.is_public;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("planner_users")
    .update(update)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

export async function DELETE() {
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  // Trips this person created but still shares with someone else should
  // survive them — hand ownership to whoever joined next before the
  // planner_users delete below cascades through planner_trips.created_by.
  // A trip with no other member has no one to hand off to, so it's
  // removed along with everything else the delete cascades (memberships,
  // ratings, availability marks, and so on).
  const { data: ownedTrips } = await admin.from("planner_trips").select("id").eq("created_by", user.id);

  for (const trip of ownedTrips ?? []) {
    const { data: successor } = await admin
      .from("planner_memberships")
      .select("user_id")
      .eq("trip_id", trip.id)
      .neq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (successor) {
      await admin.from("planner_trips").update({ created_by: successor.user_id }).eq("id", trip.id);
      await admin
        .from("planner_memberships")
        .update({ role: "owner" })
        .eq("trip_id", trip.id)
        .eq("user_id", successor.user_id);
    }
  }

  const { error } = await admin.from("planner_users").delete().eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (user.auth_user_id) {
    await admin.auth.admin.deleteUser(user.auth_user_id);
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
