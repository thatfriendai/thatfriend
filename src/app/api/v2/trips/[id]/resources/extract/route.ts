import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { fetchPageText, deriveLabelFromUrl } from "@/lib/planner/fetchPage";
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
    sourceUrl = url;

    // Re-adding the same link that never produced a place shouldn't
    // re-fetch/re-extract and pile up another empty resource row — just
    // say it's already saved. A link that DID produce a place is left to
    // run the normal pipeline below, which already reports the specific
    // duplicate place by name (more useful than a generic "already saved").
    const { data: existingResource } = await admin
      .from("planner_resources")
      .select("id")
      .eq("trip_id", tripId)
      .eq("source_url", url)
      .maybeSingle();
    if (existingResource) {
      const { data: existingPlace } = await admin
        .from("planner_places")
        .select("id")
        .eq("resource_id", existingResource.id)
        .limit(1)
        .maybeSingle();
      if (!existingPlace) {
        return NextResponse.json({ alreadyAdded: true, candidates: [] });
      }
    }

    const page = await fetchPageText(url);

    // A link we can't read (paywalled, bot-blocked — Forbes-style sites do
    // this a lot) has nothing to extract a place from, but it's still worth
    // keeping around — falls through with zero candidates and a label
    // de-slugified from the URL itself, same as any other link that turns
    // up no places.
    if (!page) {
      label = deriveLabelFromUrl(url);
      candidates = [];
    } else {
      label = page.label;
      candidates = await extractPlacesFromText(page.text);

      // A Google Maps link names one real, already-identified place — pull
      // its real category and coordinates now rather than letting the LLM
      // guess the kind from almost no text, and reuse them at confirm time
      // instead of geocoding the same place twice.
      // The link's own address/coordinates are the truth here — appending
      // the trip's city to a bare name forced same-named places elsewhere
      // onto the trip's map. Only kind/lat/lng/address are used here — the
      // confirm step re-geocodes for the real photo, so skip the extra
      // Photo billing on this call.
      if (page.mapsPlace) {
        const geo = await geocodePlace(page.mapsPlace.query, { wantPhoto: false });
        if (geo) {
          const kind = kindFromGoogleTypes(geo.types);
          const first = candidates[0];
          candidates = [
            {
              name: page.mapsPlace.name,
              kind: kind ?? first?.kind ?? "Other",
              note: first?.note ?? "",
              lat: geo.lat,
              lng: geo.lng,
              address: geo.address,
            },
          ];
        }
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

  // Resources are for links — an article or a video worth keeping around.
  // A link always gets saved, even one with nothing extractable in it (see
  // above). Pasted text or a screenshot with zero places found has nothing
  // worth keeping as a "resource" — it's not a link to anything, just a
  // failed extraction attempt — so nothing gets persisted for those unless
  // real places actually come out of it.
  if (type !== "link" && candidates.length === 0) {
    return NextResponse.json({ resource: null, candidates: [] });
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
