import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!email && !phone) {
    return NextResponse.json({ error: "Provide an email or phone." }, { status: 400 });
  }

  const admin = createAdminClient();
  const query = admin.from("planner_users").select("id").limit(1);

  const { data } = email
    ? await query.eq("email", email).maybeSingle()
    : await query.eq("phone", phone).maybeSingle();

  return NextResponse.json({ exists: Boolean(data) });
}
