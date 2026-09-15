import "server-only";
import { unstable_cache } from "next/cache";

export interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
  types: string[];
  googlePlaceId: string | null;
  photoUrl: string | null;
}

interface PlaceSearchResult {
  lat: number;
  lng: number;
  address: string;
  types: string[];
  googlePlaceId: string | null;
  // The photo's stable resource name, not a resolved URL — Google's Photo
  // media endpoint returns a signed, time-limited URL, which is exactly
  // why it's kept out of the cached part of a lookup (see fetchPhotoUrl).
  photoName: string | null;
}

function getServerGoogleMapsKey(): string | undefined {
  return process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

/** Fetches a real photo for a place via the Places API (New) Photo media endpoint — server-side REST, not the browser SDK's getURI(). Never cached: the URL this returns is Google-signed and expires. */
async function fetchPlacePhotoUrl(photoName: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=480&key=${apiKey}&skipHttpRedirect=true`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.photoUri === "string" ? data.photoUri : null;
  } catch {
    return null;
  }
}

/**
 * The actual Text Search call — everything about it is stable for as long
 * as the place exists (location, address, types, id, and the photo's
 * resource name), so this half is what gets cached. Split out from photo
 * URL resolution specifically so a long cache window can't ever serve a
 * stale, expired Google-signed photo link.
 */
async function searchTextUncached(query: string, bias?: { lat: number; lng: number }): Promise<PlaceSearchResult | null> {
  const apiKey = getServerGoogleMapsKey();
  if (!apiKey) return null;

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.location,places.formattedAddress,places.types,places.photos",
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 1,
        ...(bias
          ? {
              locationBias: {
                circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 50000 },
              },
            }
          : {}),
      }),
    });
    if (!res.ok) {
      // Silent by design everywhere else this result is used — but a bad key
      // (wrong project, HTTP-referrer restricted, API not enabled) fails every
      // single call the same way, so it's worth one line in the server logs.
      console.error(`geocodePlace: Places API returned ${res.status} for "${query}"`, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    const place = data.places?.[0];
    if (!place?.location) return null;

    return {
      lat: place.location.latitude,
      lng: place.location.longitude,
      address: place.formattedAddress ?? "",
      types: Array.isArray(place.types) ? place.types : [],
      googlePlaceId: place.id ?? null,
      photoName: (place.photos?.[0]?.name as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

// A place's location/address/id essentially never changes — 30 days is
// plenty, and cuts a repeat lookup (the same restaurant forwarded by two
// different people, the same guide place cloned into another trip) down
// to a cache read instead of a billed Places API call.
const cachedSearchText = unstable_cache(searchTextUncached, ["geocode-search-text"], { revalidate: 2592000 });

/**
 * Resolves a place name (plus trip destination for disambiguation, e.g.
 * "Time Out Market, Lisbon, Portugal") to a real position — and, where one
 * exists, a real photo — via Google's Places API (New) Text Search. Returns
 * null on any failure — geocoding a saved place is a nice-to-have, not
 * something that should block saving it, same as this codebase's other
 * best-effort external calls.
 *
 * The Place Photo media fetch is a second, separate billed call on top of
 * the Text Search — pass `wantPhoto: false` for places where a photo is a
 * nice-to-have, not the point (e.g. one pulled from pasted text rather than
 * a real Maps link), to keep Places API costs down.
 *
 * `bias` nudges results toward a location without restricting to it — a
 * plain "Versailles Restaurant" is ambiguous enough that an unbiased search
 * can return a same-named business in a different city entirely, but a
 * genuinely unique name with no local match still resolves to its one real
 * (possibly far away) location. Pass the trip destination's own geocoded
 * point here when checking whether a place is actually near it.
 */
export async function geocodePlace(
  query: string,
  options: { wantPhoto?: boolean; bias?: { lat: number; lng: number } } = {}
): Promise<GeocodeResult | null> {
  const { wantPhoto = true, bias } = options;
  const apiKey = getServerGoogleMapsKey();
  const trimmed = query.trim();
  if (!apiKey || !trimmed) return null;

  const search = await cachedSearchText(trimmed, bias);
  if (!search) return null;

  const photoUrl = wantPhoto && search.photoName ? await fetchPlacePhotoUrl(search.photoName, apiKey) : null;

  return {
    lat: search.lat,
    lng: search.lng,
    address: search.address,
    types: search.types,
    googlePlaceId: search.googlePlaceId,
    photoUrl,
  };
}
