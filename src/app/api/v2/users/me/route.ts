import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export async function PATCH(request: Request) {
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();
  const update: Record<string, string | boolean | null> = {};

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
    update.tagline = body.tagline.trim().slice(0, 140) || null;
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
    .select("username, tagline, is_public")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
