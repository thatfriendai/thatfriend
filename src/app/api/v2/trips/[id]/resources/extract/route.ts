import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { fetchPageText } from "@/lib/planner/fetchPage";
import { extractPlacesFromText, extractPlacesFromImage, type ExtractedPlace } from "@/lib/planner/extract";
import { geocodePlace } from "@/lib/planner/geocode";
import { kindFromGoogleTypes } from "@/lib/planner/itinerary";

type EnrichedPlace = ExtractedPlace & { lat?: number; lng?: number; address?: string };

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this trip." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const type = body.type;

  let label: string;
  let sourceUrl: string | null = null;
  let candidates: EnrichedPlace[];

  if (type === "link") {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return NextResponse.json({ error: "A link is required." }, { status: 400 });
    const page = await fetchPageText(url);
    if (!page) {
      return NextResponse.json(
        { error: "Couldn't read that link. Try pasting the text instead." },
        { status: 422 }
      );
    }
    sourceUrl = url;
    label = page.label;
    candidates = await extractPlacesFromText(page.text);

    // A Google Maps link names one real, already-identified place — pull
    // its real category and coordinates now rather than letting the LLM
    // guess the kind from almost no text, and reuse them at confirm time
    // instead of geocoding the same place twice.
    if (page.mapsPlaceName) {
      const { data: trip } = await admin.from("planner_trips").select("destination").eq("id", tripId).maybeSingle();
      const query = trip?.destination ? `${page.mapsPlaceName}, ${trip.destination}` : page.mapsPlaceName;
      // Only kind/lat/lng/address are used here — the confirm step re-geocodes
      // for the real photo, so skip the extra Photo billing on this call.
      const geo = await geocodePlace(query, { wantPhoto: false });
      if (geo) {
        const kind = kindFromGoogleTypes(geo.types);
        candidates = candidates.map((c) => ({
          ...c,
          ...(kind ? { kind } : {}),
          lat: geo.lat,
          lng: geo.lng,
          address: geo.address,
        }));
      }
    }
  } else if (type === "text") {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "Paste some text first." }, { status: 400 });
    label = text.slice(0, 60) + (text.length > 60 ? "…" : "");
    candidates = await extractPlacesFromText(text);
  } else if (type === "screenshot") {
    const image = typeof body.image === "string" ? body.image : "";
    const mediaType = IMAGE_TYPES.includes(body.mediaType) ? body.mediaType : null;
    if (!image || !mediaType) {
      return NextResponse.json({ error: "A screenshot is required." }, { status: 400 });
    }
    label = "Screenshot";
    candidates = await extractPlacesFromImage(image, mediaType);
  } else {
    return NextResponse.json({ error: "Unknown source type." }, { status: 400 });
  }

  const { data: resource, error } = await admin
    .from("planner_resources")
    .insert({
      trip_id: tripId,
      type,
      label,
      source_url: sourceUrl,
      added_by: user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ resource, candidates });
}
