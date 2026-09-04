import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { fetchPageText } from "@/lib/planner/fetchPage";
import { extractLodgingOption } from "@/lib/planner/extractLodging";

/**
 * Adds one option to an already-open decision. Two shapes of request:
 *  - { url }: previews an extracted lodging option from a pasted listing
 *    link, WITHOUT persisting it — the client reviews/edits, then re-posts
 *    the (possibly edited) fields as a normal manual add.
 *  - manual fields (label required): persists a new
 *    planner_decision_options row straight away.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; decisionId: string }> }
) {
  const { id: tripId, decisionId } = await params;
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

  const { data: decision } = await admin
    .from("planner_decisions")
    .select("id, status")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });
  if (decision.status !== "open") {
    return NextResponse.json({ error: "This decision is closed." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));

  if (typeof body.url === "string" && body.url.trim() && typeof body.label !== "string") {
    const page = await fetchPageText(body.url.trim());
    if (!page) return NextResponse.json({ error: "Couldn't read that link." }, { status: 400 });
    const candidate = await extractLodgingOption(page.text);
    if (!candidate) {
      return NextResponse.json({ error: "Couldn't find listing details on that page." }, { status: 400 });
    }
    return NextResponse.json({ candidate: { ...candidate, source_url: body.url.trim() } });
  }

  const label = typeof body.label === "string" ? body.label.trim().slice(0, 120) : "";
  if (!label) return NextResponse.json({ error: "A name is required." }, { status: 400 });

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const amenities = Array.isArray(body.amenities)
    ? body.amenities
        .filter((a: unknown): a is { label: unknown; available: unknown } => !!a && typeof a === "object")
        .map((a: { label: unknown; available: unknown }) => ({
          label: String(a.label ?? "").slice(0, 40),
          available: Boolean(a.available),
        }))
        .filter((a: { label: string }) => a.label)
        .slice(0, 12)
    : [];

  const { count } = await admin
    .from("planner_decision_options")
    .select("id", { count: "exact", head: true })
    .eq("decision_id", decisionId);

  const { data: option, error } = await admin
    .from("planner_decision_options")
    .insert({
      decision_id: decisionId,
      trip_id: tripId,
      position: count ?? 0,
      label,
      sub: str(body.sub),
      cost: str(body.cost),
      fors: [],
      against: [],
      option_type: str(body.option_type),
      price_per_person_night: num(body.price_per_person_night),
      total_price: num(body.total_price),
      bedrooms: Number.isInteger(body.bedrooms) ? body.bedrooms : null,
      bathrooms: Number.isInteger(body.bathrooms) ? body.bathrooms : null,
      sharing_note: str(body.sharing_note),
      amenities,
      neighborhood: str(body.neighborhood),
      location_note: str(body.location_note),
      lat: num(body.lat),
      lng: num(body.lng),
      source_url: str(body.source_url),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ option });
}
