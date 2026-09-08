import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { listFriends } from "@/lib/planner/follows";

export async function GET() {
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const friends = await listFriends(admin, user.id);
  return NextResponse.json({ friends });
}
