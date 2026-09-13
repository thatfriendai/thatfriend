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

/**
 * A confirmed Google place id match is unambiguous. Otherwise, fall back to
 * a name match — exact first, then "one name starts with the other" (e.g.
 * "Joe's Pizza" vs. "Joe's Pizza (West Village)"), since re-extracting the
 * same forwarded text twice doesn't always produce byte-identical names,
 * and without a working geocode to fall back on, name is all there is.
 */
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
  const exact = existing.find((p) => normalizeName(p.name) === normalized);
  if (exact) return exact;
  if (normalized.length < 4) return undefined;
  return existing.find((p) => {
    const other = normalizeName(p.name);
    return other.length >= 4 && (normalized.startsWith(other) || other.startsWith(normalized));
  });
}
