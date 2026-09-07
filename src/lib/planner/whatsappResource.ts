import "server-only";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KIND_OPTIONS, hashPercent } from "./itinerary";
import { extractPlacesFromText, extractPlacesFromImage, type ExtractedPlace } from "./extract";
import { fetchPageText } from "./fetchPage";
import { loadExistingPlaces, findDuplicatePlace } from "./placeDedupe";
import { geocodePlace } from "./geocode";
import { isGoogleMapsUrl } from "./mapsLink";
import { milesBetween } from "./distance";

// A trip destination is usually a city — a genuinely nearby place (an
// outer-suburb restaurant, an airport hotel) can legitimately sit 40-50
// miles from its center. Past this, it's almost certainly a different city
// entirely, not a stretch of the same trip.
const FAR_AWAY_MILES = 75;

function isLikelyUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

interface AddResult {
  places: { name: string; kind: string }[];
  resourceLabel: string;
  duplicates: string[];
  farAway: { name: string; address: string | null }[];
}

/**
 * The WhatsApp path skips the web app's extract-then-review modal — a
 * forwarded message has no one there to review candidates, so whatever
 * gets extracted is added straight away and summarized back in the reply.
 */
export async function addResourceFromWhatsAppText(
  admin: SupabaseClient,
  tripId: string,
  userId: string,
  text: string
): Promise<AddResult | { error: string }> {
  const trimmed = text.trim();
  const asLink = isLikelyUrl(trimmed);

  let extractText = trimmed;
  let label = trimmed.slice(0, 60) + (trimmed.length > 60 ? "…" : "");
  let sourceUrl: string | null = null;
  const type = asLink ? "link" : "text";

  if (asLink) {
    const page = await fetchPageText(trimmed);
    if (!page) return { error: "Couldn't read that link." };
    extractText = page.text;
    label = page.label;
    sourceUrl = trimmed;
  }

  const candidates = await extractPlacesFromText(extractText);
  return persistCandidates(admin, tripId, userId, type, label, sourceUrl, candidates);
}

export async function addResourceFromWhatsAppImage(
  admin: SupabaseClient,
  tripId: string,
  userId: string,
  base64: string,
  mimeType: string
): Promise<AddResult | { error: string }> {
  const mediaType = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)
    ? (mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif")
    : "image/jpeg";
  const candidates = await extractPlacesFromImage(base64, mediaType);
  return persistCandidates(admin, tripId, userId, "screenshot", "Screenshot", null, candidates);
}

async function persistCandidates(
  admin: SupabaseClient,
  tripId: string,
  userId: string,
  type: "link" | "text" | "screenshot",
  label: string,
  sourceUrl: string | null,
  candidates: ExtractedPlace[]
): Promise<AddResult | { error: string }> {
  const { data: resource, error: resourceError } = await admin
    .from("planner_resources")
    .insert({ trip_id: tripId, type, label, source_url: sourceUrl, added_by: userId })
    .select("id")
    .single();
  if (resourceError || !resource) {
    return { error: resourceError?.message ?? "Could not save that." };
  }

  if (candidates.length === 0) {
    return { places: [], resourceLabel: label, duplicates: [], farAway: [] };
  }

  // Forwarded texts get no review step, so the same link or caption
  // texted twice (easy to do by accident) would otherwise create a
  // second copy of the same place every time. Checked by name up front —
  // no point geocoding a place we're about to discard as a duplicate.
  const existingPlaces = await loadExistingPlaces(admin, tripId);
  const newCandidates = candidates.filter((c) => !findDuplicatePlace(existingPlaces, c.name));
  const duplicates = candidates
    .filter((c) => findDuplicatePlace(existingPlaces, c.name))
    .map((c) => c.name);

  if (newCandidates.length === 0) {
    return { places: [], resourceLabel: label, duplicates, farAway: [] };
  }

  const { data: trip } = await admin
    .from("planner_trips")
    .select("destination")
    .eq("id", tripId)
    .maybeSingle();
  const destination = trip?.destination ?? null;

  // A second, billed Places API call on top of the search — only worth it
  // for a real Maps link, same rule used everywhere else a place gets
  // geocoded.
  const wantPhoto = type === "link" && isGoogleMapsUrl(sourceUrl);

  // Geocoded by name alone, not "name, destination" — appending the
  // destination as literal query text would force a match near it and
  // defeat the point of checking whether the place is actually there.
  // `bias` is a softer nudge: it resolves an ambiguous common name (there's
  // more than one "Versailles Restaurant") to the one near the trip when
  // there is one, but a genuinely unique name with no local match still
  // resolves to its one real, possibly-far-away location.
  const destGeo = destination ? await geocodePlace(destination, { wantPhoto: false }) : null;
  const bias = destGeo ? { lat: destGeo.lat, lng: destGeo.lng } : undefined;
  const geocodedCandidates = await Promise.all(
    newCandidates.map((c) => geocodePlace(c.name, { wantPhoto, bias }))
  );

  const farAway: { name: string; address: string | null }[] = [];
  const enriched = newCandidates.map((c, i) => {
    const geo = geocodedCandidates[i];
    if (destGeo && geo) {
      const miles = milesBetween(destGeo, geo);
      if (miles > FAR_AWAY_MILES) farAway.push({ name: c.name, address: geo.address || null });
    }
    return { candidate: c, geo };
  });

  // A second dedup pass now that geocoding may have turned up a Google
  // place id — catches "Uchi" vs. "Uchi Miami" naming a place already
  // saved under a different name, which the name-only pass above can't.
  const kept: typeof enriched = [];
  for (const item of enriched) {
    if (findDuplicatePlace(existingPlaces, item.candidate.name, item.geo?.googlePlaceId)) {
      duplicates.push(item.candidate.name);
    } else {
      kept.push(item);
    }
  }

  if (kept.length === 0) {
    return { places: [], resourceLabel: label, duplicates, farAway };
  }

  const rows = kept.map(({ candidate: c, geo }) => {
    const id = randomUUID();
    const { x, y } = hashPercent(id);
    const kind = KIND_OPTIONS.some((k) => k.kind === c.kind) ? c.kind : "Other";
    return {
      id,
      trip_id: tripId,
      day_id: null,
      name: c.name,
      kind,
      note: c.note || null,
      map_x: x,
      map_y: y,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      address: geo?.address ?? null,
      added_by: userId,
      resource_id: resource.id,
      google_place_id: geo?.googlePlaceId ?? null,
      photo_url: geo?.photoUrl ?? null,
    };
  });

  const { error: placesError } = await admin.from("planner_places").insert(rows);
  if (placesError) return { error: placesError.message };

  return {
    places: rows.map((r) => ({ name: r.name, kind: r.kind })),
    resourceLabel: label,
    duplicates,
    farAway,
  };
}
