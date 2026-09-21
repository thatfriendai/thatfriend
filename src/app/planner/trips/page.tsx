import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/planner/actions";
import { HomeNav } from "@/components/planner/HomeNav";
import { TripsAndSavedView, type PastTripRow, type TripRowData } from "./TripsAndSavedView";

function formatDates(start: string | null, end: string | null) {
  if (!start) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(start + "T00:00:00").toLocaleDateString(undefined, opts).toUpperCase();
  if (!end) return s;
  const e = new Date(end + "T00:00:00").toLocaleDateString(undefined, opts).toUpperCase();
  return `${s}–${e}`;
}

function daysSince(dateStr: string, todayStr: string) {
  return Math.floor((Date.parse(todayStr) - Date.parse(dateStr)) / 86400000);
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

type TripRow = {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export default async function PlannerTripsPage() {
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  const userId = user.id;
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // Phase 1: the only queries that don't depend on anything but user.id —
  // one round trip instead of running ahead of everything else below one
  // at a time.
  const [{ data: memberships }, { data: tripSaveRows }, { data: savedPlaceRows }] = await Promise.all([
    admin
      .from("planner_memberships")
      .select("role, planner_trips(id, name, destination, start_date, end_date, created_at)")
      .eq("user_id", user.id),
    admin.from("planner_trip_saves").select("trip_id, created_at").eq("user_id", user.id),
    admin.from("planner_saved_places").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  const rows = (memberships ?? [])
    .map((m) => ({
      role: m.role as string,
      trip: m.planner_trips as unknown as TripRow | null,
    }))
    .filter((x): x is { role: string; trip: TripRow } => Boolean(x.trip));

  // A trip drops to Past a week after it ends — everyone else (no dates
  // yet, upcoming, or freshly wrapped) stays in the sortable list above.
  const currentRows = rows.filter((r) => !(r.trip.end_date && daysSince(r.trip.end_date, today) > 7));
  const pastRows = rows.filter((r) => r.trip.end_date && daysSince(r.trip.end_date, today) > 7);
  const currentTripIds = currentRows.map((r) => r.trip.id);
  const savedTripIds = (tripSaveRows ?? []).map((r) => r.trip_id as string);

  // Phase 2: none of these depend on each other, only on the id lists above.
  const [{ data: memberRows }, { data: markRows }, { data: savedTripRows }] = await Promise.all([
    currentTripIds.length
      ? admin.from("planner_memberships").select("trip_id, user_id, role").in("trip_id", currentTripIds)
      : Promise.resolve({ data: [] as { trip_id: string; user_id: string; role: string }[] }),
    currentTripIds.length
      ? admin.from("planner_availability_marks").select("trip_id, user_id").in("trip_id", currentTripIds)
      : Promise.resolve({ data: [] as { trip_id: string; user_id: string }[] }),
    savedTripIds.length
      ? admin.from("planner_trips").select("id, name, destination, start_date, end_date, created_by").in("id", savedTripIds)
      : Promise.resolve({ data: [] }),
  ]);

  const memberUserIds = [...new Set((memberRows ?? []).map((m) => m.user_id as string))];
  const { data: memberUserRows } = memberUserIds.length
    ? await admin.from("planner_users").select("id, name, username").in("id", memberUserIds)
    : { data: [] };
  const nameById = new Map(
    (memberUserRows ?? []).map((u) => [u.id as string, (u.name as string | null) || (u.username as string | null) || "Someone"])
  );

  const membersByTrip = new Map<string, { user_id: string; role: string }[]>();
  for (const m of memberRows ?? []) {
    const list = membersByTrip.get(m.trip_id as string) ?? [];
    list.push({ user_id: m.user_id as string, role: m.role as string });
    membersByTrip.set(m.trip_id as string, list);
  }
  const answeredByTrip = new Map<string, Set<string>>();
  for (const m of markRows ?? []) {
    const set = answeredByTrip.get(m.trip_id as string) ?? new Set<string>();
    set.add(m.user_id as string);
    answeredByTrip.set(m.trip_id as string, set);
  }

  function buildRow(trip: TripRow, role: string): TripRowData {
    const members = membersByTrip.get(trip.id) ?? [];
    const travelers = members.length;
    const answered = (answeredByTrip.get(trip.id) ?? new Set()).size;
    const waiting = travelers - answered;
    const solo = travelers === 1;
    const hasDate = Boolean(trip.start_date);

    const status = solo ? "No one added yet" : waiting === 0 ? "Everyone answered" : `${answered} of ${travelers} answered`;
    const urgency = solo ? 1 : waiting * 10 + (hasDate ? 0 : 5);
    const needs = urgency >= 10;

    let sub = trip.destination ?? "";
    let cta: string;
    if (role === "owner") {
      cta = solo ? "Add friends" : waiting > 0 ? "Nudge them" : "Open";
    } else {
      const organizer = members.find((m) => m.role === "owner");
      const organizerName = organizer ? (nameById.get(organizer.user_id) ?? "Someone").split(/\s+/)[0] : "Someone";
      sub = [sub, `You're a traveler · ${organizerName} is organizing`].filter(Boolean).join(" · ");
      const viewerAnswered = (answeredByTrip.get(trip.id) ?? new Set()).has(userId);
      cta = viewerAnswered ? "Open" : "Answer";
    }

    return {
      id: trip.id,
      name: trip.name,
      sub,
      dateLabel: formatDates(trip.start_date, trip.end_date) ?? "No dates yet",
      hasDate,
      startDate: trip.start_date,
      createdAt: trip.created_at,
      travelers,
      answered,
      status,
      needs,
      urgency,
      cta,
      people: members.slice(0, 5).map((m) => {
        const name = nameById.get(m.user_id) ?? "Someone";
        return { name, initials: initialsOf(name) };
      }),
    };
  }

  const yoursRows = currentRows.filter((r) => r.role === "owner").map((r) => buildRow(r.trip, r.role));
  const invitedRows = currentRows.filter((r) => r.role !== "owner").map((r) => buildRow(r.trip, r.role));

  const needingYours = yoursRows.filter((r) => r.needs).length;
  const yoursLead =
    needingYours === 0
      ? "Nothing is waiting on you right now."
      : `${needingYours} trip${needingYours === 1 ? "" : "s"} need${needingYours === 1 ? "s" : ""} something from you.`;

  const needingInvited = invitedRows.filter((r) => r.needs).length;
  const invitedLead =
    needingInvited === 0
      ? "Nothing is waiting on you right now."
      : `${needingInvited} trip${needingInvited === 1 ? "" : "s"} ${needingInvited === 1 ? "is" : "are"} waiting on your answer.`;

  const pastTrips: PastTripRow[] = pastRows.map((r) => {
    const travelers = (membersByTrip.get(r.trip.id) ?? []).length || undefined;
    return {
      id: r.trip.id,
      name: r.trip.name,
      destination: r.trip.destination,
      dateLabel: formatDates(r.trip.start_date, r.trip.end_date) ?? "No dates yet",
      statusLabel: travelers ? `${travelers} traveller${travelers === 1 ? "" : "s"}` : "",
    };
  });

  // ---- Saved trips + saved places (the "Saved" tab) ----
  const ownerIdsToLookUp = [
    ...new Set([
      ...(savedTripRows ?? []).map((t) => t.created_by as string),
      ...(savedPlaceRows ?? []).map((p) => p.source_user_id as string | null).filter((id): id is string => Boolean(id)),
    ]),
  ];
  const sourceTripIdsToLookUp = [
    ...new Set(
      (savedPlaceRows ?? []).map((p) => p.source_trip_id as string | null).filter((id): id is string => Boolean(id))
    ),
  ];

  const [{ data: ownerRows }, { data: sourceTripRows }, { data: savedTripPlaceRows }] = await Promise.all([
    ownerIdsToLookUp.length
      ? admin.from("planner_users").select("id, name, username").in("id", ownerIdsToLookUp)
      : Promise.resolve({ data: [] }),
    sourceTripIdsToLookUp.length
      ? admin.from("planner_trips").select("id, destination").in("id", sourceTripIdsToLookUp)
      : Promise.resolve({ data: [] }),
    savedTripIds.length
      ? admin.from("planner_places").select("trip_id").in("trip_id", savedTripIds)
      : Promise.resolve({ data: [] as { trip_id: string }[] }),
  ]);

  const ownerNameById = new Map((ownerRows ?? []).map((o) => [o.id as string, o.name || o.username || "Someone"]));
  const sourceDestinationByTripId = new Map((sourceTripRows ?? []).map((t) => [t.id as string, t.destination as string | null]));
  const placeCountBySavedTrip = new Map<string, number>();
  for (const p of savedTripPlaceRows ?? []) {
    placeCountBySavedTrip.set(p.trip_id as string, (placeCountBySavedTrip.get(p.trip_id as string) ?? 0) + 1);
  }
  const savedAtByTrip = new Map((tripSaveRows ?? []).map((r) => [r.trip_id as string, r.created_at as string]));

  function savedLabel(tripId: string): string {
    const savedAt = savedAtByTrip.get(tripId);
    if (!savedAt) return "Saved";
    const days = daysSince(savedAt.slice(0, 10), today);
    if (days <= 0) return "Saved today";
    if (days === 1) return "Saved 1 day ago";
    if (days < 14) return `Saved ${days} days ago`;
    return `Saved in ${new Date(savedAt).toLocaleDateString(undefined, { month: "short" })}`;
  }

  const savedTrips = (savedTripRows ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    destination: t.destination as string | null,
    dateRange: formatDates(t.start_date as string | null, t.end_date as string | null),
    ownerName: ownerNameById.get(t.created_by as string) ?? "Someone",
    placesCount: placeCountBySavedTrip.get(t.id as string) ?? 0,
    savedLabel: savedLabel(t.id as string),
  }));
  const savedLead =
    savedTrips.length === 0
      ? "Nothing saved yet."
      : `${savedTrips.length} trip${savedTrips.length === 1 ? "" : "s"} you kept from other people.`;

  const savedPlaces = (savedPlaceRows ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    kind: p.kind as string,
    lat: p.lat as number | null,
    lng: p.lng as number | null,
    address: p.address as string | null,
    googlePlaceId: p.google_place_id as string | null,
    photoUrl: p.photo_url as string | null,
    location: p.source_trip_id ? (sourceDestinationByTripId.get(p.source_trip_id as string) ?? null) : null,
    ownerName: p.source_user_id ? (ownerNameById.get(p.source_user_id as string) ?? "someone") : "someone",
    sourcePlaceId: p.source_place_id as string | null,
    sourceTripId: p.source_trip_id as string | null,
    sourceUserId: p.source_user_id as string | null,
  }));

  // ---- Own trips + days, for the Saved tab's "Add to itinerary" picker ----
  const allTripIds = rows.map((r) => r.trip.id);
  const { data: dayRows } = allTripIds.length
    ? await admin.from("planner_days").select("id, trip_id, date").in("trip_id", allTripIds).order("date", { ascending: true })
    : { data: [] };
  const daysByTrip = new Map<string, { id: string; label: string }[]>();
  for (const d of dayRows ?? []) {
    const label = new Date((d.date as string) + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const list = daysByTrip.get(d.trip_id as string) ?? [];
    list.push({ id: d.id as string, label });
    daysByTrip.set(d.trip_id as string, list);
  }
  const ownTripsForPicker = rows.map((r) => ({
    id: r.trip.id,
    name: r.trip.name,
    days: daysByTrip.get(r.trip.id) ?? [],
  }));

  const initial = (user.name || user.email || "?")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen">
      <HomeNav initial={initial} username={user.username} tripsCount={rows.length} signOutAction={signOut} />

      <div className="mx-auto max-w-[1180px] px-6 py-11 pb-24 sm:px-8">
        <TripsAndSavedView
          yoursLead={yoursLead}
          invitedLead={invitedLead}
          savedLead={savedLead}
          yoursRows={yoursRows}
          invitedRows={invitedRows}
          pastTrips={pastTrips}
          savedTrips={savedTrips}
          savedPlaces={savedPlaces}
          ownTripsForPicker={ownTripsForPicker}
        />
      </div>
    </div>
  );
}
