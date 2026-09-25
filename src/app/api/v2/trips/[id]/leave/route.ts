import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { departMember } from "@/lib/planner/membership";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();
  const result = await departMember(admin, tripId, user.id, { kind: "left" });

  if (result.outcome === "not_found") return NextResponse.json({ error: "Not a member of this trip." }, { status: 404 });
  if (result.outcome === "already_gone") return NextResponse.json({ error: "You've already left this trip." }, { status: 400 });
  if (result.outcome === "must_transfer_first") {
    return NextResponse.json(
      { error: "Transfer the trip to someone else before leaving — an organizer can't just disappear." },
      { status: 400 }
    );
  }
  if (result.outcome === "error") return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ ok: true });
}
