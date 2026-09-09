import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/planner/actions";
import { HomeNav } from "@/components/planner/HomeNav";
import { getNavCounts } from "@/lib/planner/navCounts";
import { TripsAndSavedView } from "./TripsAndSavedView";

function formatDates(start: string | null, end: string | null) {
  if (!start) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(start + "T00:00:00").toLocaleDateString(undefined, opts).toUpperCase();
  if (!end) return s;
  const e = new Date(end + "T00:00:00").toLocaleDateString(undefined, opts).toUpperCase();
  return `${s}–${e}`;
}

type TripRow = {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  dates_locked_at: string | null;
};

type TripStatus = "in_planning" | "booked" | "just_back" | "past";

export default async function PlannerTripsPage() {
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("planner_memberships")
    .select(
      "role, planner_trips(id, name, destination, start_date, end_date, dates_locked_at)"
    )
    .eq("user_id", user.id);

  const rows = (memberships ?? [])
    .map((m) => ({
      role: m.role,
      trip: m.planner_trips as unknown as TripRow | null,
    }))
    .filter((x): x is { role: string; trip: TripRow } => Boolean(x.trip));

  const allTripIds = rows.map((r) => r.trip.id);
  const today = new Date().toISOString().slice(0, 10);

  const { data: memberRows } = allTripIds.length
    ? await admin.from("planner_memberships").select("trip_id").in("trip_id", allTripIds)
    : { data: [] };
  const memberCounts = new Map<string, number>();
  for (const m of memberRows ?? []) {
    memberCounts.set(m.trip_id, (memberCounts.get(m.trip_id) ?? 0) + 1);
  }

  const inPlanningIds = rows.filter((r) => !r.trip.dates_locked_at).map((r) => r.trip.id);
  const { data: markRows } = inPlanningIds.length
    ? await admin
        .from("planner_availability_marks")
        .select("trip_id, user_id")
        .in("trip_id", inPlanningIds)
    : { data: [] };
  const answeredCounts = new Map<string, number>();
  for (const tripId of inPlanningIds) {
    const distinct = new Set(
      (markRows ?? []).filter((m) => m.trip_id === tripId).map((m) => m.user_id)
    );
    answeredCounts.set(tripId, distinct.size);
  }

  const recentIds = rows
    .filter(
      (r) =>
        r.trip.dates_locked_at &&
        r.trip.end_date &&
        r.trip.end_date < today
    )
    .map((r) => r.trip.id);

  const { data: recentItems } = recentIds.length
    ? await admin.from("planner_itinerary_items").select("id, trip_id").in("trip_id", recentIds)
    : { data: [] };
  const { data: myRatings } = recentIds.length
    ? await admin
        .from("planner_item_ratings")
        .select("item_id, trip_id")
        .eq("user_id", user.id)
        .in("trip_id", recentIds)
    : { data: [] };
  const { data: allRatings } = recentIds.length
    ? await admin.from("planner_item_ratings").select("item_id, trip_id").in("trip_id", recentIds)
    : { data: [] };
  const { data: myReviews } = recentIds.length
    ? await admin
        .from("planner_trip_reviews")
        .select("trip_id")
        .eq("user_id", user.id)
        .in("trip_id", recentIds)
    : { data: [] };

  const myRatedItemIds = new Set((myRatings ?? []).map((r) => r.item_id));
  const reviewedTripIds = new Set((myReviews ?? []).map((r) => r.trip_id));

  const unratedCounts = new Map<string, number>();
  const ratedTotals = new Map<string, number>();
  for (const tripId of recentIds) {
    const items = (recentItems ?? []).filter((i) => i.trip_id === tripId);
    const unrated = items.filter((i) => !myRatedItemIds.has(i.id)).length;
    unratedCounts.set(tripId, unrated);
    const ratedItemIds = new Set(
      (allRatings ?? []).filter((r) => r.trip_id === tripId).map((r) => r.item_id)
    );
    ratedTotals.set(tripId, ratedItemIds.size);
  }

  function statusOf(trip: TripRow): TripStatus {
    if (!trip.dates_locked_at) return "in_planning";
    if (!trip.end_date || trip.end_date >= today) return "booked";
    const daysSince = Math.floor(
      (Date.parse(today) - Date.parse(trip.end_date)) / 86400000
    );
    const unrated = unratedCounts.get(trip.id) ?? 0;
    const reviewed = reviewedTripIds.has(trip.id);
    if (daysSince <= 30 && (unrated > 0 || !reviewed)) return "just_back";
    return "past";
  }

  const grouped: Record<TripStatus, { role: string; trip: TripRow }[]> = {
    just_back: [],
    in_planning: [],
    booked: [],
    past: [],
  };
  for (const r of rows) grouped[statusOf(r.trip)].push(r);

  const firstName = (user.name || user.email || "there").split(/[\s@]/)[0];
  const initial = (user.name || user.email || "?")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const { savedCount } = await getNavCounts(admin, user.id);
  const needsSomething = grouped.just_back.length + grouped.in_planning.length;

  const sections: { key: TripStatus; label: string }[] = [
    { key: "just_back", label: "Just back" },
    { key: "in_planning", label: "In planning" },
    { key: "booked", label: "Booked" },
    { key: "past", label: "Past" },
  ];

  // ---- Saved trips + saved places (the "Saved" tab) ----
  const { data: tripSaveRows } = await admin
    .from("planner_trip_saves")
    .select("trip_id")
    .eq("user_id", user.id);
  const savedTripIds = (tripSaveRows ?? []).map((r) => r.trip_id as string);

  const { data: savedTripRows } = savedTripIds.length
    ? await admin
        .from("planner_trips")
        .select("id, name, destination, start_date, end_date, created_by")
        .in("id", savedTripIds)
    : { data: [] };

  const { data: savedPlaceRows } = await admin
    .from("planner_saved_places")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

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

  const [{ data: ownerRows }, { data: sourceTripRows }] = await Promise.all([
    ownerIdsToLookUp.length
      ? admin.from("planner_users").select("id, name, username").in("id", ownerIdsToLookUp)
      : Promise.resolve({ data: [] }),
    sourceTripIdsToLookUp.length
      ? admin.from("planner_trips").select("id, destination").in("id", sourceTripIdsToLookUp)
      : Promise.resolve({ data: [] }),
  ]);

  const ownerNameById = new Map((ownerRows ?? []).map((o) => [o.id as string, o.name || o.username || "Someone"]));
  const sourceDestinationByTripId = new Map((sourceTripRows ?? []).map((t) => [t.id as string, t.destination as string | null]));

  const savedTrips = (savedTripRows ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    destination: t.destination as string | null,
    dateRange: formatDates(t.start_date as string | null, t.end_date as string | null),
    ownerName: ownerNameById.get(t.created_by as string) ?? "Someone",
  }));

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

  // ---- Own trips + days, for the "Add to itinerary" picker ----
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

  const yoursContent = (
    <>
      <h1 className="mb-2 text-[42px] leading-[1.06] font-display tracking-tight text-ink">
        Morning, {firstName}.
      </h1>
      <p className="mb-13 text-base text-body">
        {rows.length === 0
          ? "No trips yet — start the one you keep talking about."
          : needsSomething > 0
            ? `${needsSomething} trip${needsSomething === 1 ? "" : "s"} need${needsSomething === 1 ? "s" : ""} something from you.`
            : `${rows.length} trip${rows.length === 1 ? "" : "s"} you're part of.`}
      </p>

      {sections.map(({ key, label }) => {
        const list = grouped[key];
        if (list.length === 0) return null;
        return (
          <div key={key} className="mb-11">
            <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
              {label}
            </p>
            {list.map(({ trip, role }) => {
              let statusLine: string;
              if (key === "in_planning") {
                const answered = answeredCounts.get(trip.id) ?? 0;
                const total = memberCounts.get(trip.id) ?? 0;
                statusLine = `${answered} of ${total} answered`;
              } else if (key === "booked") {
                statusLine = "All set";
              } else if (key === "just_back") {
                const unrated = unratedCounts.get(trip.id) ?? 0;
                statusLine = unrated > 0 ? `${unrated} place${unrated === 1 ? "" : "s"} to rate` : "Trip review pending";
              } else {
                const rated = ratedTotals.get(trip.id) ?? 0;
                statusLine = `${rated} place${rated === 1 ? "" : "s"} rated`;
              }
              return (
                <Link
                  key={trip.id}
                  href={
                    key === "just_back"
                      ? `/planner/trips/${trip.id}/reviews`
                      : `/planner/trips/${trip.id}`
                  }
                  className="grid grid-cols-1 gap-1.5 border-b border-border-soft py-5.5 hover:bg-card sm:grid-cols-[1.5fr_0.9fr_1fr] sm:items-center sm:gap-6"
                >
                  <div>
                    <p className="text-[25px] leading-tight font-display text-ink">
                      {trip.name}
                    </p>
                    {trip.destination && (
                      <p className="mt-1 text-sm text-muted">{trip.destination}</p>
                    )}
                  </div>
                  <p className="font-mono text-[12.5px] text-body">
                    {formatDates(trip.start_date, trip.end_date) ?? "No dates yet"}
                  </p>
                  <p className="text-sm text-body">
                    {statusLine}
                    <span className="ml-2 text-muted">
                      &middot; {role === "owner" ? "You're organizing" : "You're in"}
                    </span>
                  </p>
                </Link>
              );
            })}
          </div>
        );
      })}

      <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-input-border p-7 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p className="mb-1.5 text-2xl font-display text-ink">
            The one you keep talking about
          </p>
          <p className="text-[15px] text-body">
            Name it, add three friends, and let That Friend do the asking.
          </p>
        </div>
        <Link
          href="/planner/trips/new"
          className="rounded-full border border-input-border bg-card px-6 py-3 text-[15px] whitespace-nowrap text-ink hover:border-ink"
        >
          Start a trip
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen">
      <HomeNav initial={initial} username={user.username} tripsCount={rows.length} savedCount={savedCount} signOutAction={signOut} />

      <div className="mx-auto max-w-[1000px] px-6 py-15 pb-28">
        <TripsAndSavedView
          savedTrips={savedTrips}
          savedPlaces={savedPlaces}
          ownTripsForPicker={ownTripsForPicker}
          ownTripCount={rows.length}
        >
          {yoursContent}
        </TripsAndSavedView>
      </div>
    </div>
  );
}
