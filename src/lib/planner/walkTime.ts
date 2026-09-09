import "server-only";
import { milesBetween } from "./distance";

const WALK_SPEED_MPH = 4;
const DETOUR_FACTOR = 1.35;
const NEARBY_WALK_MINUTES = 15;

/** Straight-line miles -> an approximate walking time, padded for the fact that streets don't run in straight lines. */
function walkMinutesForMiles(miles: number): number {
  return ((miles * DETOUR_FACTOR) / WALK_SPEED_MPH) * 60;
}

/**
 * For one lodging option's position, finds how many of the trip's saved
 * places are within roughly a 15-minute walk and the median walk time to
 * that set. Straight-line distance + a detour factor, not a real routing
 * call — comparative between options, not a promise of the actual walk.
 * Computed fresh on every read rather than cached: at the scale of a
 * handful of options and places per trip this is fast enough that a cache
 * (and the invalidation it'd need whenever a place or option moves) isn't
 * worth the complexity yet.
 */
export function nearbyPlaces(
  option: { lat: number | null; lng: number | null },
  places: { lat: number | null; lng: number | null }[]
): { walkMinutes: number | null; savedPlacesNear: number } {
  if (option.lat == null || option.lng == null) {
    return { walkMinutes: null, savedPlacesNear: 0 };
  }

  const minutes = places
    .filter((p): p is { lat: number; lng: number } => p.lat != null && p.lng != null)
    .map((p) => walkMinutesForMiles(milesBetween({ lat: option.lat as number, lng: option.lng as number }, p)))
    .filter((m) => m <= NEARBY_WALK_MINUTES)
    .sort((a, b) => a - b);

  if (minutes.length === 0) return { walkMinutes: null, savedPlacesNear: 0 };

  const mid = Math.floor(minutes.length / 2);
  const median = minutes.length % 2 === 0 ? (minutes[mid - 1] + minutes[mid]) / 2 : minutes[mid];

  return { walkMinutes: Math.round(median), savedPlacesNear: minutes.length };
}
