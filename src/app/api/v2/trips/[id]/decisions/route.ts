import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";

interface IncomingOption {
  label?: unknown;
  sub?: unknown;
  cost?: unknown;
  fors?: unknown;
  against?: unknown;
}

function toLines(v: unknown): string[] {
  if (typeof v !== "string") return [];
  return v
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((l) => l.slice(0, 140));
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
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  const why = typeof body.why === "string" ? body.why.trim().slice(0, 1000) : null;
  const kind = body.kind === "stay" ? "stay" : "general";
  const nights = Number.isInteger(body.nights) && body.nights > 0 ? body.nights : null;
  const partySize = Number.isInteger(body.party_size) && body.party_size > 0 ? body.party_size : null;
  const rawOptions: IncomingOption[] = Array.isArray(body.options) ? body.options : [];
  const options = rawOptions
    .filter((o): o is IncomingOption & { label: string } => typeof o.label === "string" && o.label.trim().length > 0)
    .slice(0, 6)
    .map((o) => ({
      label: o.label.trim().slice(0, 120),
      sub: typeof o.sub === "string" && o.sub.trim() ? o.sub.trim().slice(0, 200) : null,
      cost: typeof o.cost === "string" && o.cost.trim() ? o.cost.trim().slice(0, 80) : null,
      fors: toLines(o.fors),
      against: toLines(o.against),
    }));

  // Stay decisions start empty — options get pasted in one at a time
  // afterward, rather than all up front like a general decision.
  if (!title || (kind === "general" && options.length < 2)) {
    return NextResponse.json(
      { error: "A title and at least two options are required." },
      { status: 400 }
    );
  }

  const { data: decision, error: decisionError } = await admin
    .from("planner_decisions")
    .insert({ trip_id: tripId, title, why, created_by: user.id, kind, nights, party_size: partySize })
    .select("*")
    .single();

  if (decisionError) return NextResponse.json({ error: decisionError.message }, { status: 500 });

  if (options.length === 0) {
    return NextResponse.json({ decision, options: [] });
  }

  const { data: createdOptions, error: optionsError } = await admin
    .from("planner_decision_options")
    .insert(
      options.map((o, i) => ({
        decision_id: decision.id,
        trip_id: tripId,
        position: i,
        ...o,
      }))
    )
    .select("*");

  if (optionsError) {
    await admin.from("planner_decisions").delete().eq("id", decision.id);
    return NextResponse.json({ error: optionsError.message }, { status: 500 });
  }

  return NextResponse.json({ decision, options: createdOptions });
}
