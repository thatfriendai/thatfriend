import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlannerDecisionOption, StayAmenities } from "@/lib/supabase/planner-types";
import { nearbyPlaces } from "./walkTime";

export interface StayComparisonOption {
  id: string;
  label: string;
  source: string | null;
  url: string | null;
  image_url: string | null;
  per_person_per_night: number | null;
  total_cost: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds_note: string | null;
  amenities: StayAmenities;
  rating: number | null;
  rating_count: number | null;
  neighborhood: string | null;
  location_note: string | null;
  walk_minutes: number | null;
  saved_places_near: number;
  best_in: string[];
  votes: string[];
}

export interface StayComparison {
  party_size: number;
  nights: number | null;
  currency: string | null;
  rows: string[];
  options: StayComparisonOption[];
}

const EMPTY_AMENITIES: StayAmenities = {
  kitchen: null,
  ac: null,
  washer: null,
  pool: null,
  breakfast: null,
  wifi: null,
};

function markBest(
  options: StayComparisonOption[],
  key: "per_person_per_night" | "bathrooms" | "walk_minutes",
  direction: "min" | "max",
  tag: string
) {
  const withValue = options.filter((o) => o[key] != null) as (StayComparisonOption & Record<typeof key, number>)[];
  // Only mark a row if at least three options actually have a value for it —
  // a "best" among one or two isn't a meaningful comparison.
  if (withValue.length < 3) return;
  const values = withValue.map((o) => o[key]);
  const target = direction === "min" ? Math.min(...values) : Math.max(...values);
  const winners = withValue.filter((o) => o[key] === target);
  if (winners.length === 1) winners[0].best_in.push(tag);
}

/**
 * Builds the derived comparison view for a 'stay' decision — the client
 * never recomputes any of this itself. party_size comes from the trip's
 * current membership count, not a stored number, so adding a traveller
 * re-prices every option the next time this is read.
 */
export async function buildStayComparison(
  admin: SupabaseClient,
  tripId: string,
  decisionId: string,
  nights: number | null,
  partySize: number
): Promise<StayComparison> {
  const [{ data: rawOptions }, { data: rawVotes }, { data: rawPlaces }] = await Promise.all([
    admin
      .from("planner_decision_options")
      .select("*")
      .eq("decision_id", decisionId)
      .order("position", { ascending: true }),
    admin.from("planner_decision_votes").select("option_id, user_id").eq("decision_id", decisionId),
    admin.from("planner_places").select("lat, lng").eq("trip_id", tripId),
  ]);

  const votesByOption = new Map<string, string[]>();
  for (const v of rawVotes ?? []) {
    const list = votesByOption.get(v.option_id) ?? [];
    list.push(v.user_id);
    votesByOption.set(v.option_id, list);
  }

  const places = rawPlaces ?? [];
  const currency = (rawOptions ?? []).find((o) => o.currency)?.currency ?? null;

  const options: StayComparisonOption[] = (rawOptions as PlannerDecisionOption[] | null ?? []).map((o) => {
    const perPersonPerNight =
      o.total_cost != null && partySize > 0 && nights && nights > 0
        ? Math.round((o.total_cost / partySize / nights) * 100) / 100
        : null;
    const { walkMinutes, savedPlacesNear } = nearbyPlaces({ lat: o.lat, lng: o.lng }, places);

    return {
      id: o.id,
      label: o.label,
      source: o.source,
      url: o.url,
      image_url: o.image_url,
      per_person_per_night: perPersonPerNight,
      total_cost: o.total_cost,
      currency: o.currency,
      bedrooms: o.bedrooms,
      bathrooms: o.bathrooms,
      beds_note: o.beds_note,
      amenities: { ...EMPTY_AMENITIES, ...(o.amenities as Partial<StayAmenities> | null) },
      rating: o.rating,
      rating_count: o.rating_count,
      neighborhood: o.neighborhood,
      location_note: o.location_note,
      walk_minutes: walkMinutes,
      saved_places_near: savedPlacesNear,
      best_in: [],
      votes: votesByOption.get(o.id) ?? [],
    };
  });

  markBest(options, "per_person_per_night", "min", "cost");
  markBest(options, "bathrooms", "max", "sleeping");
  markBest(options, "walk_minutes", "min", "location");

  return {
    party_size: partySize,
    nights,
    currency,
    rows: ["cost", "sleeping", "amenities", "location", "rating"],
    options,
  };
}
