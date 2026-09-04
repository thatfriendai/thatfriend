import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { draftDayItinerary } from "@/lib/planner/draftDay";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  const { id: tripId, dayId } = await params;
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

  const { data: day } = await admin
    .from("planner_days")
    .select("id, date, city")
    .eq("id", dayId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!day) return NextResponse.json({ error: "Day not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const excludePlaceIds: string[] = Array.isArray(body.exclude_place_ids)
    ? body.exclude_place_ids.filter((v: unknown) => typeof v === "string")
    : [];

  const { data: unscheduledRows } = await admin
    .from("planner_places")
    .select("id, name, kind, note, planner_users(name, email)")
    .eq("trip_id", tripId)
    .is("day_id", null);

  const unscheduled = (unscheduledRows ?? []).map((p) => {
    const person = p.planner_users as unknown as { name: string | null; email: string | null } | null;
    return {
      id: p.id as string,
      name: p.name as string,
      kind: p.kind as string,
      note: p.note as string | null,
      savedBy: person?.name || person?.email?.split("@")[0] || null,
    };
  });

  const { data: otherDays } = await admin
    .from("planner_days")
    .select("date, city, planner_itinerary_items(text)")
    .eq("trip_id", tripId)
    .neq("id", dayId)
    .order("date", { ascending: true });

  const scheduledDays = (otherDays ?? []).map((d) => ({
    date: d.date as string,
    city: d.city as string | null,
    placeNames: ((d.planner_itinerary_items as unknown as { text: string }[]) ?? []).map((i) => i.text),
  }));

  const draft = await draftDayItinerary(day.date, day.city, unscheduled, scheduledDays, excludePlaceIds);
  if (!draft) {
    return NextResponse.json({ error: "Could not draft this day right now." }, { status: 502 });
  }

  const chosen = unscheduled.filter((p) => draft.placeIds.includes(p.id));
  const orderedChosen = draft.placeIds
    .map((id) => chosen.find((p) => p.id === id))
    .filter((p): p is (typeof chosen)[number] => Boolean(p));

  return NextResponse.json({ places: orderedChosen, reasoning: draft.reasoning });
}
