import "server-only";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KIND_OPTIONS, hashPercent } from "./itinerary";
import { extractPlacesFromText, extractPlacesFromImages, type ExtractedPlace } from "./extract";
import { fetchPageText, deriveLabelFromUrl } from "./fetchPage";
import { loadExistingPlaces, findDuplicatePlace } from "./placeDedupe";
import { geocodePlace } from "./geocode";
import { isGoogleMapsUrl } from "./mapsLink";
import { milesBetween } from "./distance";

// A trip destination is usually a city — a genuinely nearby place (an
// outer-suburb restaurant, an airport hotel) can legitimately sit 40-50
// miles from its center. Past this, it's almost certainly a different city
// entirely, not a stretch of the same trip.
const FAR_AWAY_MILES = 75;

/**
 * A share-sheet forward is rarely a bare link — it's "Check this out
 * https://maps.app.goo.gl/abc" or a TikTok link with "must go" typed under
 * it. Treating the whole text as a URL mangled it (the URL parser quietly
 * drops the newline and glues the caption onto the path), and treating it
 * as plain text never fetched the link at all. So: the first http(s) URL
 * is the link, whatever's left is the caption.
 */
export function splitLinkAndCaption(text: string): { url: string; caption: string } | null {
  const match = text.match(/https?:\/\/[^\s<>"]+/i);
  if (!match || match.index === undefined) return null;
  let url = match[0].replace(/[.,!?;:'"]+$/, "");
  // A closing paren is usually the sentence's ("(see https://…)"), unless
  // the URL opened one itself (Wikipedia-style "/Foo_(bar)").
  if (url.endsWith(")") && !url.includes("(")) url = url.replace(/\)+$/, "");
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  const caption = (text.slice(0, match.index) + " " + text.slice(match.index + match[0].length))
    .replace(/\s+/g, " ")
    .trim();
  return { url, caption };
}

// Share-tracking junk that differs every time the same link is shared —
// left in, the same Instagram post forwarded twice looked like two links.
const TRACKING_PARAM_RE = /^(?:utm_.*|igsh|igshid|si|fbclid|gclid)$/i;

/** The link with share-tracking params removed — what gets stored as source_url and compared for "already saved". */
export function normalizeSourceUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAM_RE.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

interface AddResult {
  places: { name: string; kind: string }[];
  resourceLabel: string;
  duplicates: string[];
  farAway: { name: string; address: string | null }[];
  alreadyAdded?: boolean;
  /** A link that was kept in Resources but named no place — worth saying so, since the sender expects something on the map. */
  savedLinkOnly?: boolean;
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
  const link = splitLinkAndCaption(trimmed);
  const asLink = Boolean(link);

  let extractText = trimmed;
  let label = trimmed.slice(0, 60) + (trimmed.length > 60 ? "…" : "");
  let sourceUrl: string | null = null;
  let candidates: ExtractedPlace[] = [];
  const type = asLink ? "link" : "text";

  if (link) {
    sourceUrl = normalizeSourceUrl(link.url);

    // Same as the web app: re-forwarding a link that never produced a
    // place shouldn't re-fetch/re-extract and create another empty
    // resource — just say it's already saved. A link that DID produce a
    // place falls through to the normal pipeline, which already reports
    // the specific duplicate place by name.
    const { data: existingResource } = await admin
      .from("planner_resources")
      .select("id")
      .eq("trip_id", tripId)
      // Rows saved before tracking params were stripped still hold the raw link.
      .in("source_url", [...new Set([sourceUrl, link.url])])
      .limit(1)
      .maybeSingle();
    if (existingResource) {
      const { data: existingPlace } = await admin
        .from("planner_places")
        .select("id")
        .eq("resource_id", existingResource.id)
        .limit(1)
        .maybeSingle();
      if (!existingPlace) {
        return { places: [], resourceLabel: label, duplicates: [], farAway: [], alreadyAdded: true };
      }
    }

    const page = await fetchPageText(sourceUrl);
    // The caption often names the place outright ("Lacivert, must go") —
    // it goes first so the page text's 8000-char cap can't cut it off.
    const withCaption = (pageText: string) =>
      link.caption ? `Note from the person who shared this: ${link.caption}\n\n${pageText}` : pageText;
    // A link we can't read (paywalled, bot-blocked) has nothing to extract
    // a place from, but — same as the web app — it's still worth keeping
    // as a resource, so this falls through with zero candidates and a
    // label de-slugified from the URL instead of erroring out.
    if (page) {
      extractText = withCaption(page.text);
      label = page.label;
      candidates = await extractPlacesFromText(extractText);
      // A Maps link is one exact place — keep the model's kind guess, but
      // make sure the name is the real one and geocoding uses the full
      // address from the link rather than the name plus a city nudge.
      if (page.mapsPlace) {
        const { name, query } = page.mapsPlace;
        const first = candidates[0];
        candidates = [{ name, kind: first?.kind ?? "Other", note: first?.note ?? "", geocodeQuery: query }];
      }
    } else {
      label = deriveLabelFromUrl(sourceUrl);
      if (link.caption) candidates = await extractPlacesFromText(link.caption);
    }
  } else {
    candidates = await extractPlacesFromText(extractText);
  }

  return persistCandidates(admin, tripId, userId, type, label, sourceUrl, candidates);
}

export async function addResourceFromWhatsAppImage(
  admin: SupabaseClient,
  tripId: string,
  userId: string,
  images: { base64: string; mimeType: string }[]
): Promise<AddResult | { error: string }> {
  const normalized = images.map(({ base64, mimeType }) => ({
    base64,
    mediaType: (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)
      ? mimeType
      : "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  }));
  const candidates = await extractPlacesFromImages(normalized);
  const label = images.length > 1 ? `${images.length} screenshots` : "Screenshot";
  return persistCandidates(admin, tripId, userId, "screenshot", label, null, candidates);
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
  // A forwarded text/screenshot only becomes a trip-visible "resource"
  // (shown, attributed, in Sources) once it's actually produced a place —
  // creating the row up front meant every private DM that didn't pan out
  // (or wasn't even about the trip) still left the sender's name and a
  // snippet of what they wrote visible to the whole group.
  //
  // A forwarded link is different: it's already a deliberate "here's
  // something to look at" share, not an off-the-cuff aside, and Resources
  // is specifically meant to hold articles/videos like this — so a link
  // that names no place still gets kept, same as the web app's "+Add → A
  // link" does for the same case.
  if (candidates.length === 0) {
    if (type === "link" && sourceUrl) {
      await admin.from("planner_resources").insert({ trip_id: tripId, type, label, source_url: sourceUrl, added_by: userId });
      return { places: [], resourceLabel: label, duplicates: [], farAway: [], savedLinkOnly: true };
    }
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
    .select("name, destination")
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
  // A trip's own name often names its city informally ("Thanksgiving
  // Miami") even when the dedicated destination field was never filled
  // in — worth a second attempt before giving up on the far-away check
  // entirely, since a null destGeo silently disables it below. But a name
  // like "Bach Weekend" still resolves to *something* on Places — only
  // trust that guess as a real anchor point when it actually looks like a
  // place (a locality/region), not a business or landmark, or it spams
  // "doesn't look nearby" on every place saved from a trip with no
  // destination field set.
  const LOCALITY_TYPES = new Set([
    "locality",
    "sublocality",
    "administrative_area_level_1",
    "administrative_area_level_2",
    "administrative_area_level_3",
    "country",
  ]);
  const destGeo = destination
    ? await geocodePlace(destination, { wantPhoto: false })
    : trip?.name
      ? await geocodePlace(trip.name, { wantPhoto: false }).then((g) =>
          g && g.types.some((t) => LOCALITY_TYPES.has(t)) ? g : null
        )
      : null;
  const bias = destGeo ? { lat: destGeo.lat, lng: destGeo.lng } : undefined;
  const geocodedCandidates = await Promise.all(
    newCandidates.map((c) =>
      c.geocodeQuery ? geocodePlace(c.geocodeQuery, { wantPhoto }) : geocodePlace(c.name, { wantPhoto, bias })
    )
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

  // Now that we know this message is actually becoming a place, create the
  // resource row that makes it visible ("added by X") in the trip's Sources
  // section — same attribution a place added through the app already gets.
  const { data: resource, error: resourceError } = await admin
    .from("planner_resources")
    .insert({ trip_id: tripId, type, label, source_url: sourceUrl, added_by: userId })
    .select("id")
    .single();
  if (resourceError || !resource) {
    return { error: resourceError?.message ?? "Could not save that." };
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
