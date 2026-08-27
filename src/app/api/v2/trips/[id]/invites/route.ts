import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { generateToken } from "@/lib/planner/tokens";

interface InviteRequest {
  email?: string;
  phone?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;

  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }

  const body: InviteRequest[] = await request.json().catch(() => []);
  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ error: "Provide a list of { email | phone }." }, { status: 400 });
  }

  const rows = body
    .map((entry) => {
      const email = entry.email?.trim().toLowerCase();
      const phone = entry.phone?.trim();
      if (email) return { trip_id: tripId, channel: "email" as const, sent_to: email, token: generateToken() };
      if (phone) return { trip_id: tripId, channel: "sms" as const, sent_to: phone, token: generateToken() };
      return null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Each entry needs an email or phone." }, { status: 400 });
  }

  const { data: invites, error } = await admin
    .from("planner_invites")
    .insert(rows)
    .select("*");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Actually delivering the email/SMS invite is a follow-up — this just
  // creates the trackable invite + token. The 'link' channel from trip
  // creation doesn't need delivery, which is why it's the only one that
  // works end-to-end today.
  return NextResponse.json({ invites, delivered: false }, { status: 201 });
}
