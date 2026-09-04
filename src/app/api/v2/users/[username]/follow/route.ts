import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

async function resolveTarget(admin: ReturnType<typeof createAdminClient>, username: string) {
  const { data } = await admin.from("planner_users").select("id").eq("username", username).maybeSingle();
  return data?.id ?? null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const targetId = await resolveTarget(admin, username);
  if (!targetId) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (targetId === user.id) return NextResponse.json({ error: "Can't follow yourself." }, { status: 400 });

  const { error } = await admin
    .from("planner_follows")
    .upsert({ follower_id: user.id, followee_id: targetId }, { onConflict: "follower_id,followee_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const targetId = await resolveTarget(admin, username);
  if (!targetId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { error } = await admin
    .from("planner_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followee_id", targetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
