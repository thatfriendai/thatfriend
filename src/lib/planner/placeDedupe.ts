import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ExistingPlace {
  name: string;
  google_place_id: string | null;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export async function loadExistingPlaces(
  admin: SupabaseClient,
  tripId: string
): Promise<ExistingPlace[]> {
  const { data } = await admin
    .from("planner_places")
    .select("name, google_place_id")
    .eq("trip_id", tripId);
  return data ?? [];
}

/** A confirmed Google place id match is unambiguous; otherwise fall back to a case-insensitive name match. */
export function findDuplicatePlace(
  existing: ExistingPlace[],
  name: string,
  googlePlaceId?: string | null
): ExistingPlace | undefined {
  if (googlePlaceId) {
    const byPlaceId = existing.find((p) => p.google_place_id === googlePlaceId);
    if (byPlaceId) return byPlaceId;
  }
  const normalized = normalizeName(name);
  return existing.find((p) => normalizeName(p.name) === normalized);
}
