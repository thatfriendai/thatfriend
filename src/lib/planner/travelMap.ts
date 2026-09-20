import "server-only";
import { cityFromAddress, countryFromAddress } from "./countries";

export interface TravelMapPlaceInput {
  tripId: string;
  tripTitle: string;
  /** Pre-formatted "Sep 2026", or null if the trip has no start date. */
  tripMonthYear: string | null;
  name: string;
  kind: string;
  rating: number;
  address: string | null;
  /** Trip destination text, used when the address doesn't yield a city. */
  fallbackCity: string | null;
}

export interface TravelMapPlace {
  name: string;
  city: string | null;
  kind: string;
  rating: number;
}

export interface TravelMapTrip {
  title: string;
  meta: string;
}

export interface TravelMapCountry {
  code: string;
  name: string;
  region: string;
  total: number;
  trips: TravelMapTrip[];
  places: TravelMapPlace[];
  /** Unique cities across this country's rated places, in no particular order. */
  cities: string[];
}

export interface TravelMap {
  countries: TravelMapCountry[];
  codes: string[];
  regionCount: number;
}

/** Groups a user's rated places by country (derived from each place's address) — the data behind the profile map's "her map"/"your map" section. Rows must already be scoped to what the viewer is allowed to see. */
export function buildTravelMap(rows: TravelMapPlaceInput[]): TravelMap {
  const buckets = new Map<
    string,
    { name: string; region: string; places: TravelMapPlaceInput[]; tripCounts: Map<string, { title: string; monthYear: string | null; count: number }> }
  >();

  for (const row of rows) {
    const ref = countryFromAddress(row.address);
    if (!ref) continue;
    let bucket = buckets.get(ref.code);
    if (!bucket) {
      bucket = { name: ref.name, region: ref.region, places: [], tripCounts: new Map() };
      buckets.set(ref.code, bucket);
    }
    bucket.places.push(row);
    const t = bucket.tripCounts.get(row.tripId) ?? { title: row.tripTitle, monthYear: row.tripMonthYear, count: 0 };
    t.count++;
    bucket.tripCounts.set(row.tripId, t);
  }

  const regions = new Set<string>();
  const countries: TravelMapCountry[] = [];
  for (const [code, bucket] of buckets) {
    regions.add(bucket.region);
    const places = bucket.places
      .slice()
      .sort((a, b) => b.rating - a.rating)
      .map((p) => ({ name: p.name, city: cityFromAddress(p.address) ?? p.fallbackCity, kind: p.kind, rating: p.rating }));
    countries.push({
      code,
      name: bucket.name,
      region: bucket.region,
      total: bucket.places.length,
      trips: [...bucket.tripCounts.values()]
        .sort((a, b) => b.count - a.count)
        .map((t) => ({ title: t.title, meta: [t.monthYear, `${t.count} rated`].filter(Boolean).join(" · ") })),
      places,
      cities: [...new Set(places.map((p) => p.city).filter((c): c is string => Boolean(c)))],
    });
  }

  countries.sort((a, b) => b.total - a.total);
  return { countries, codes: countries.map((c) => c.code), regionCount: regions.size };
}

/** The lighter-weight version for a comparison set where only "which countries" matters (the viewer's own footprint, used for the map's overlap mode) — skips the trip/place breakdown entirely. */
export function countrySet(addresses: (string | null)[]): Set<string> {
  const codes = new Set<string>();
  for (const address of addresses) {
    const ref = countryFromAddress(address);
    if (ref) codes.add(ref.code);
  }
  return codes;
}
