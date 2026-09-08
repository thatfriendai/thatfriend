import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import type { StayAmenities, StaySource } from "@/lib/supabase/planner-types";

const SOURCE_VALUES: StaySource[] = ["airbnb", "hotel", "aparthotel", "other"];
const AMENITY_KEYS = ["kitchen", "ac", "washer", "pool", "breakfast", "wifi"] as const;

/**
 * Any trip member can edit any option's fields — a comparison is a shared
 * document, not something only its adder can correct (someone else often
 * has the real bathroom count or spots a stale price first).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; decisionId: string; optionId: string }> }
) {
  const { id: tripId, decisionId, optionId } = await params;
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

  const { data: existing } = await admin
    .from("planner_decision_options")
    .select("id, amenities")
    .eq("id", optionId)
    .eq("decision_id", decisionId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Option not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const patch: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) patch.label = body.label.trim().slice(0, 120);
  if ("sub" in body) patch.sub = str(body.sub);
  if ("source" in body) patch.source = SOURCE_VALUES.includes(body.source) ? body.source : null;
  if ("total_cost" in body) patch.total_cost = num(body.total_cost);
  if ("currency" in body) patch.currency = str(body.currency);
  if ("bedrooms" in body) patch.bedrooms = Number.isInteger(body.bedrooms) ? body.bedrooms : null;
  if ("bathrooms" in body) patch.bathrooms = Number.isInteger(body.bathrooms) ? body.bathrooms : null;
  if ("beds_note" in body) patch.beds_note = str(body.beds_note);
  if ("rating" in body) patch.rating = num(body.rating);
  if ("rating_count" in body) patch.rating_count = Number.isInteger(body.rating_count) ? body.rating_count : null;
  if ("neighborhood" in body) patch.neighborhood = str(body.neighborhood);
  if ("location_note" in body) patch.location_note = str(body.location_note);
  if ("lat" in body) patch.lat = num(body.lat);
  if ("lng" in body) patch.lng = num(body.lng);
  if ("url" in body) patch.url = str(body.url);
  if ("image_url" in body) patch.image_url = str(body.image_url);

  if (body.amenities && typeof body.amenities === "object") {
    // Merge, not replace — editing one amenity shouldn't null out the rest,
    // and a key left out of the patch is "unchanged," not "unknown."
    const current = (existing.amenities as Partial<StayAmenities>) ?? {};
    const merged: Record<string, boolean | null> = { ...current };
    for (const key of AMENITY_KEYS) {
      const v = (body.amenities as Record<string, unknown>)[key];
      if (typeof v === "boolean" || v === null) merged[key] = v;
    }
    patch.amenities = merged;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data: option, error } = await admin
    .from("planner_decision_options")
    .update(patch)
    .eq("id", optionId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ option });
}
