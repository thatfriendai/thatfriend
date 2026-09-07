import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { KIND_OPTIONS, hashPercent } from "@/lib/planner/itinerary";
import { geocodePlace } from "@/lib/planner/geocode";
import { isGoogleMapsUrl } from "@/lib/planner/mapsLink";
import { loadExistingPlaces, findDuplicatePlace } from "@/lib/planner/placeDedupe";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; resourceId: string }> }
) {
  const { id: tripId, resourceId } = await params;
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

  const { data: resource } = await admin
    .from("planner_resources")
    .select("id, type, source_url")
    .eq("id", resourceId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!resource) return NextResponse.json({ error: "Resource not found." }, { status: 404 });

  // The Place Photo lookup is a second billed Places API call on top of the
  // geocoding search — only worth it for a real Maps link, where we know
  // there's a genuine listing photo, not for text/screenshot sources.
  const wantPhoto = resource.type === "link" && isGoogleMapsUrl(resource.source_url);

  interface IncomingPlace {
    name?: unknown;
    kind?: unknown;
    note?: unknown;
    day_id?: unknown;
    lat?: unknown;
    lng?: unknown;
    address?: unknown;
  }

  const body = await request.json().catch(() => ({}));
  const places: IncomingPlace[] = Array.isArray(body.places) ? body.places : [];
  if (places.length === 0) {
    return NextResponse.json({ error: "Nothing to add." }, { status: 400 });
  }

  const { data: trip } = await admin
    .from("planner_trips")
    .select("destination")
    .eq("id", tripId)
    .maybeSingle();

  const dayIds = [
    ...new Set(
      places
        .map((p) => p.day_id)
        .filter((d): d is string => typeof d === "string" && d.length > 0)
    ),
  ];
  const validDayIds = new Set<string>();
  if (dayIds.length > 0) {
    const { data: days } = await admin
      .from("planner_days")
      .select("id")
      .eq("trip_id", tripId)
      .in("id", dayIds);
    (days ?? []).forEach((d) => validDayIds.add(d.id));
  }

  const named = places.filter(
    (p): p is IncomingPlace & { name: string } => typeof p.name === "string" && p.name.trim().length > 0
  );

  // Check by name before geocoding — no point spending a Places API call
  // resolving a place we're about to discard as an existing duplicate.
  const existingPlaces = await loadExistingPlaces(admin, tripId);
  const duplicates: string[] = [];
  const kept = named.filter((p) => {
    const dup = findDuplicatePlace(existingPlaces, p.name.trim());
    if (dup) {
      duplicates.push(p.name.trim());
      return false;
    }
    return true;
  });

  const geocoded = await Promise.all(
    kept.map(async (p) => {
      const id = randomUUID();
      const { x, y } = hashPercent(id);
      const kind = KIND_OPTIONS.some((k) => k.kind === p.kind) ? (p.kind as string) : "Other";
      const dayId = typeof p.day_id === "string" && validDayIds.has(p.day_id) ? p.day_id : null;
      const name = String(p.name).trim().slice(0, 120);

      const providedLat = typeof p.lat === "number" && Number.isFinite(p.lat) ? p.lat : null;
      const providedLng = typeof p.lng === "number" && Number.isFinite(p.lng) ? p.lng : null;
      let lat = providedLat;
      let lng = providedLng;
      let address = typeof p.address === "string" ? p.address : null;

      // Always looked up, even when a Maps link already gave us lat/lng —
      // this is also where the real photo and Google place id come from.
      const geo = await geocodePlace(
        trip?.destination ? `${name}, ${trip.destination}` : name,
        { wantPhoto }
      );
      if (lat == null || lng == null) {
        lat = geo?.lat ?? null;
        lng = geo?.lng ?? null;
        address = geo?.address ?? address;
      }
      const googlePlaceId = geo?.googlePlaceId ?? null;
      const photoUrl = geo?.photoUrl ?? null;

      return {
        id,
        trip_id: tripId,
        day_id: dayId,
        name,
        kind,
        note: typeof p.note === "string" ? p.note.trim().slice(0, 500) || null : null,
        map_x: x,
        map_y: y,
        lat,
        lng,
        address,
        added_by: user.id,
        resource_id: resourceId,
        google_place_id: googlePlaceId,
        photo_url: photoUrl,
      };
    })
  );

  // Geocoding can turn up a Google place id that matches an existing place
  // saved under a different name (e.g. "Uchi" vs. "Uchi Miami") — catch
  // that case too, now that we actually have an id to compare.
  const rows = geocoded.filter((r) => {
    const dup = findDuplicatePlace(existingPlaces, r.name, r.google_place_id);
    if (dup) {
      duplicates.push(r.name);
      return false;
    }
    return true;
  });

  if (rows.length === 0) {
    if (duplicates.length > 0) {
      return NextResponse.json({ places: [], duplicates });
    }
    return NextResponse.json({ error: "Nothing to add." }, { status: 400 });
  }

  const { data: created, error } = await admin.from("planner_places").insert(rows).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ places: created, duplicates });
}
