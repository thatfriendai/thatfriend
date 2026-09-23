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
 * Cross-trip "Needs you" list for the Home page: open decisions closing
 * inside 48h that you haven't voted on. Capped at 3. A trip with no dates
 * used to be a higher-priority item in this same list, but that's now
 * shown directly on that trip's own card on Home ("Add dates") instead of
 * as a separate feed entry — one less place saying the same thing, and the
 * card's button actually does what it says (its old label, "Send the
 * ask", didn't send anything; it just linked to the trip). Unrated places
 * from a wrapped trip are a third kind of "needs you" — see
 * computeTripsToRate below for why that's still its own function.
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
      // Already-passed deadlines aren't "closing soon" (matches attention.ts).
      if (deadline > Date.now() && deadline <= in48h && !voted) {
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

  return decisionItems.slice(0, 3);
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
