import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { fetchPageText } from "@/lib/planner/fetchPage";
import { extractLodgingOption } from "@/lib/planner/extractLodging";
import type { StayAmenities, StaySource } from "@/lib/supabase/planner-types";

const SOURCE_VALUES: StaySource[] = ["airbnb", "hotel", "aparthotel", "other"];
const AMENITY_KEYS = ["kitchen", "ac", "washer", "pool", "breakfast", "wifi"] as const;

function parseAmenities(v: unknown): StayAmenities {
  const amenities: StayAmenities = { kitchen: null, ac: null, washer: null, pool: null, breakfast: null, wifi: null };
  if (!v || typeof v !== "object") return amenities;
  for (const key of AMENITY_KEYS) {
    const val = (v as Record<string, unknown>)[key];
    if (typeof val === "boolean") amenities[key] = val;
  }
  return amenities;
}

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
    return NextResponse.json({
      candidate: { ...candidate, url: body.url.trim(), image_url: page.imageUrl ?? null },
    });
  }

  const label = typeof body.label === "string" ? body.label.trim().slice(0, 120) : "";
  if (!label) return NextResponse.json({ error: "A name is required." }, { status: 400 });

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

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
      source: SOURCE_VALUES.includes(body.source) ? body.source : null,
      total_cost: num(body.total_cost),
      currency: str(body.currency),
      bedrooms: Number.isInteger(body.bedrooms) ? body.bedrooms : null,
      bathrooms: Number.isInteger(body.bathrooms) ? body.bathrooms : null,
      beds_note: str(body.beds_note),
      amenities: parseAmenities(body.amenities),
      rating: num(body.rating),
      rating_count: Number.isInteger(body.rating_count) ? body.rating_count : null,
      neighborhood: str(body.neighborhood),
      location_note: str(body.location_note),
      lat: num(body.lat),
      lng: num(body.lng),
      url: str(body.url),
      image_url: str(body.image_url),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ option });
}
