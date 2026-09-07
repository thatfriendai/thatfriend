import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/planner/actions";

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
  const initial = (user.name || user.email || "?").trim()[0]?.toUpperCase() ?? "?";
  const needsSomething = grouped.just_back.length + grouped.in_planning.length;

  const sections: { key: TripStatus; label: string }[] = [
    { key: "just_back", label: "Just back" },
    { key: "in_planning", label: "In planning" },
    { key: "booked", label: "Booked" },
    { key: "past", label: "Past" },
  ];

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-y-3 border-b border-border bg-card px-5 py-5 sm:px-10">
        <span className="text-[23px] tracking-tight font-display text-ink">
          &ldquo;that friend&rdquo;
        </span>
        <div className="flex items-center gap-3.5 sm:gap-5">
          <Link
            href="/planner/friends"
            className="text-[14.5px] text-body hover:text-accent"
          >
            Friends
          </Link>
          <Link
            href="/planner/trips/new"
            className="rounded-full bg-ink px-5 py-2.5 text-[14.5px] text-cream hover:bg-accent"
          >
            Start a trip
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-[14.5px] text-body hover:text-accent"
            >
              Sign out
            </button>
          </form>
          <Link
            href="/planner/profile"
            className="flex h-7.5 w-7.5 items-center justify-center rounded-full bg-accent text-xs text-on-accent hover:opacity-80"
            title="Profile"
          >
            {initial}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1000px] px-6 py-15 pb-28">
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
      </div>
    </div>
  );
}
