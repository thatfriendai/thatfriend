import "server-only";

export interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
  types: string[];
}

/**
 * Resolves a place name (plus trip destination for disambiguation, e.g.
 * "Time Out Market, Lisbon, Portugal") to a real position via Google's
 * Places API (New) Text Search. Returns null on any failure — geocoding
 * a saved place is a nice-to-have, not something that should block saving
 * it, same as this codebase's other best-effort external calls.
 */
export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || !query.trim()) return null;

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.location,places.formattedAddress,places.types",
      },
      body: JSON.stringify({ textQuery: query, pageSize: 1 }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const place = data.places?.[0];
    if (!place?.location) return null;

    return {
      lat: place.location.latitude,
      lng: place.location.longitude,
      address: place.formattedAddress ?? "",
      types: Array.isArray(place.types) ? place.types : [],
    };
  } catch {
    return null;
  }
}
