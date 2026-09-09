import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export async function GET(request: Request) {
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const candidate = (searchParams.get("u") ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(candidate)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }

  const admin = createAdminClient();
  const { data: taken } = await admin
    .from("planner_users")
    .select("id")
    .eq("username", candidate)
    .neq("id", user.id)
    .maybeSingle();

  return NextResponse.json({ available: !taken });
}
