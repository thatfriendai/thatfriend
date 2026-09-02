import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { KIND_OPTIONS, hashPercent } from "@/lib/planner/itinerary";
import { geocodePlace } from "@/lib/planner/geocode";

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
    .select("id")
    .eq("id", resourceId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!resource) return NextResponse.json({ error: "Resource not found." }, { status: 404 });

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

  const kept = places.filter(
    (p): p is IncomingPlace & { name: string } => typeof p.name === "string" && p.name.trim().length > 0
  );

  const rows = await Promise.all(
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

      // Already geocoded at extract time (a Google Maps link) — reuse it
      // rather than looking the same place up twice.
      if (lat == null || lng == null) {
        const query = trip?.destination ? `${name}, ${trip.destination}` : name;
        const geo = await geocodePlace(query);
        lat = geo?.lat ?? null;
        lng = geo?.lng ?? null;
        address = geo?.address ?? address;
      }

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
      };
    })
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nothing to add." }, { status: 400 });
  }

  const { data: created, error } = await admin.from("planner_places").insert(rows).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ places: created });
}
