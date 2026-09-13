import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listVisits } from "./ratingCapture";

export interface HomeAttentionItem {
  id: string;
  title: string;
  meta: string;
  action: string;
  href: string;
  urgent: boolean;
}

/**
 * Cross-trip "Needs you" list for the Home page. Priority order, highest
 * first: a trip you organize with no dates, then an open decision closing
 * inside 48h you haven't voted on. Capped at 3 total, collected in that
 * order so the most pressing items survive the cut. Unrated places from a
 * wrapped trip used to be a third, lowest-priority item in this same list
 * — see computeTripsToRate below for why that moved to its own section.
 *
 * "Money owed by you" is in the original design spec too, but this app
 * has no expense-tracking system (the workspace top bar's Splitwise icon
 * is a "coming soon" placeholder) — there's no real data to back that
 * rule, so it's left out rather than faked.
 */
export async function computeHomeAttention(admin: SupabaseClient, userId: string): Promise<HomeAttentionItem[]> {
  const { data: membershipRows } = await admin
    .from("planner_memberships")
    .select("role, planner_trips(*)")
    .eq("user_id", userId);

  const memberships = (membershipRows ?? [])
    .map((m) => ({
      role: m.role as string,
      trip: m.planner_trips as unknown as {
        id: string;
        name: string;
        start_date: string | null;
        end_date: string | null;
        dates_locked_at: string | null;
      } | null,
    }))
    .filter((m): m is { role: string; trip: NonNullable<typeof m.trip> } => Boolean(m.trip));

  const tripIds = memberships.map((m) => m.trip.id);

  const noDatesItems: HomeAttentionItem[] = [];
  const noDatesTripIds = memberships
    .filter((m) => m.role === "owner" && !m.trip.dates_locked_at)
    .map((m) => m.trip.id);
  if (noDatesTripIds.length > 0) {
    const [{ data: memberCountRows }, { data: markRows }] = await Promise.all([
      admin.from("planner_memberships").select("trip_id").in("trip_id", noDatesTripIds),
      admin.from("planner_availability_marks").select("trip_id, user_id").in("trip_id", noDatesTripIds),
    ]);
    const totalByTrip = new Map<string, number>();
    for (const r of memberCountRows ?? []) totalByTrip.set(r.trip_id, (totalByTrip.get(r.trip_id) ?? 0) + 1);
    const answeredByTrip = new Map<string, Set<string>>();
    for (const r of markRows ?? []) {
      const set = answeredByTrip.get(r.trip_id) ?? new Set<string>();
      set.add(r.user_id);
      answeredByTrip.set(r.trip_id, set);
    }
    for (const m of memberships) {
      if (!noDatesTripIds.includes(m.trip.id)) continue;
      const answered = answeredByTrip.get(m.trip.id)?.size ?? 0;
      const total = totalByTrip.get(m.trip.id) ?? 0;
      noDatesItems.push({
        id: `dates-${m.trip.id}`,
        title: `${m.trip.name} still has no dates`,
        meta: `You're organizing · ${answered} of ${total} answered`,
        action: "Send the ask",
        href: `/planner/trips/${m.trip.id}`,
        urgent: true,
      });
    }
  }

  const decisionItems: HomeAttentionItem[] = [];
  if (tripIds.length > 0) {
    const { data: decisionRows } = await admin
      .from("planner_decisions")
      .select("id, trip_id, title, kind, deadline, planner_decision_votes(user_id)")
      .in("trip_id", tripIds)
      .eq("status", "open")
      .not("deadline", "is", null);
    const nameByTripId = new Map(memberships.map((m) => [m.trip.id, m.trip.name]));
    const in48h = Date.now() + 48 * 60 * 60 * 1000;
    for (const d of decisionRows ?? []) {
      const deadline = Date.parse(d.deadline as string);
      const voted = (d.planner_decision_votes as { user_id: string }[] | null)?.some((v) => v.user_id === userId);
      if (deadline <= in48h && !voted) {
        decisionItems.push({
          id: `decision-${d.id}`,
          title: `${d.title} closes soon`,
          meta: `${nameByTripId.get(d.trip_id as string) ?? "A trip"} · closes ${new Date(deadline).toLocaleDateString(undefined, { weekday: "short" })}`,
          action: "Vote",
          href:
            d.kind === "stay"
              ? `/planner/trips/${d.trip_id}#stays`
              : `/planner/trips/${d.trip_id}/decisions/${d.id}`,
          urgent: true,
        });
      }
    }
  }

  return [...noDatesItems, ...decisionItems].slice(0, 3);
}

/**
 * Trips that wrapped a few days ago with places you haven't rated yet —
 * its own guaranteed section on Home ("Rate your trips"), not folded into
 * computeHomeAttention's capped list. Unrated places are real but never
 * urgent, so they used to lose out to dates/decisions whenever three of
 * those existed and get silently dropped — this way they always show.
 */
export async function computeTripsToRate(admin: SupabaseClient, userId: string): Promise<HomeAttentionItem[]> {
  const { data: membershipRows } = await admin
    .from("planner_memberships")
    .select("planner_trips(id, name, end_date)")
    .eq("user_id", userId);

  const trips = (membershipRows ?? [])
    .map((m) => m.planner_trips as unknown as { id: string; name: string; end_date: string | null } | null)
    .filter((t): t is { id: string; name: string; end_date: string | null } => Boolean(t));

  const today = new Date().toISOString().slice(0, 10);
  const endedTrips = trips.filter((t) => t.end_date && t.end_date < today);

  const unratedItems: HomeAttentionItem[] = [];
  for (const trip of endedTrips) {
    const daysSince = Math.floor((Date.parse(today) - Date.parse(trip.end_date as string)) / 86400000);
    if (daysSince < 3) continue;
    const [visits, { data: myRatings }] = await Promise.all([
      listVisits(admin, trip.id),
      admin.from("planner_place_ratings").select("place_id").eq("trip_id", trip.id).eq("user_id", userId),
    ]);
    const ratedIds = new Set((myRatings ?? []).map((r) => r.place_id as string));
    const unrated = visits.filter((v) => !ratedIds.has(v.id));
    if (unrated.length > 0) {
      unratedItems.push({
        id: `rate-${trip.id}`,
        title: `Rate ${unrated.length} place${unrated.length === 1 ? "" : "s"} from ${trip.name}`,
        meta: `Trip ended ${daysSince} day${daysSince === 1 ? "" : "s"} ago`,
        action: "Rate them",
        href: `/planner/trips/${trip.id}/reviews`,
        urgent: false,
      });
    }
  }

  return unratedItems;
}
