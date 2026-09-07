import "server-only";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KIND_OPTIONS, hashPercent } from "./itinerary";
import { extractPlacesFromText, extractPlacesFromImage, type ExtractedPlace } from "./extract";
import { fetchPageText } from "./fetchPage";
import { loadExistingPlaces, findDuplicatePlace } from "./placeDedupe";

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
    return { places: [], resourceLabel: label, duplicates: [] };
  }

  // Forwarded texts get no review step, so the same link or caption
  // texted twice (easy to do by accident) would otherwise create a
  // second copy of the same place every time.
  const existingPlaces = await loadExistingPlaces(admin, tripId);
  const newCandidates = candidates.filter((c) => !findDuplicatePlace(existingPlaces, c.name));
  const duplicates = candidates
    .filter((c) => findDuplicatePlace(existingPlaces, c.name))
    .map((c) => c.name);

  if (newCandidates.length === 0) {
    return { places: [], resourceLabel: label, duplicates };
  }

  const rows = newCandidates.map((c) => {
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
      added_by: userId,
      resource_id: resource.id,
    };
  });

  const { error: placesError } = await admin.from("planner_places").insert(rows);
  if (placesError) return { error: placesError.message };

  return { places: rows.map((r) => ({ name: r.name, kind: r.kind })), resourceLabel: label, duplicates };
}
