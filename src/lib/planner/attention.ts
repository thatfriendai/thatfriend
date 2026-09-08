import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AttentionKind =
  | "vote_deadline"
  | "vote_pick"
  | "vote_needed"
  | "review_links"
  | "locate_place"
  | "draft_day"
  | "nudge_prefs";

export interface AttentionItem {
  kind: AttentionKind;
  label: string;
  cta: string;
  href: string;
  severity: "urgent" | "normal";
}

export interface Attention {
  items: AttentionItem[];
  primary: AttentionItem | null;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEADLINE_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * Computes what this trip (and this specific user) is stuck on, in the
 * priority order from the spec. Rules 1-3 are all "an open decision needs
 * attention" — only the single most urgent decision across those three
 * contributes an item, rather than one item per matching decision, so the
 * stuck list doesn't fill up with near-duplicate "vote on X" entries.
 * Rules 4-7 each contribute at most one item. `items` is every rule that
 * currently matches, in priority order, capped at 3; `primary` is
 * items[0] (or null, meaning "fall back to a plain + Add button").
 */
export async function computeAttention(
  admin: SupabaseClient,
  tripId: string,
  userId: string
): Promise<Attention> {
  const items: AttentionItem[] = [];

  const { data: decisionRows } = await admin
    .from("planner_decisions")
    .select("id, title, status, deadline, planner_decision_votes(user_id)")
    .eq("trip_id", tripId)
    .eq("status", "open");

  const decisions = (decisionRows ?? []).map((d) => ({
    id: d.id as string,
    title: d.title as string,
    deadline: d.deadline as string | null,
    votes: (d.planner_decision_votes ?? []) as { user_id: string }[],
  }));

  const hrefFor = (decisionId: string) => `/planner/trips/${tripId}/decisions/${decisionId}#decisions`;

  const withDeadlineSoon = decisions
    .filter((d) => d.deadline && new Date(d.deadline).getTime() - Date.now() < DEADLINE_WINDOW_MS && new Date(d.deadline).getTime() > Date.now())
    .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())[0];
  const zeroVotes = decisions.find((d) => d.votes.length === 0);
  const notVotedByMe = decisions.find((d) => !d.votes.some((v) => v.user_id === userId));

  if (withDeadlineSoon) {
    items.push({
      kind: "vote_deadline",
      label: `"${withDeadlineSoon.title}" is due soon`,
      cta: `Vote on ${withDeadlineSoon.title}`,
      href: hrefFor(withDeadlineSoon.id),
      severity: "urgent",
    });
  } else if (zeroVotes) {
    items.push({
      kind: "vote_pick",
      label: `"${zeroVotes.title}" has no votes yet`,
      cta: `Pick ${zeroVotes.title}`,
      href: hrefFor(zeroVotes.id),
      severity: "normal",
    });
  } else if (notVotedByMe) {
    items.push({
      kind: "vote_needed",
      label: `You haven't voted on "${notVotedByMe.title}"`,
      cta: `Vote on ${notVotedByMe.title}`,
      href: hrefFor(notVotedByMe.id),
      severity: "normal",
    });
  }

  const [{ data: resourceRows }, { data: placeRows }, { data: dayRows }, { data: memberRows }, { data: prefRows }] =
    await Promise.all([
      admin.from("planner_resources").select("id").eq("trip_id", tripId),
      admin.from("planner_places").select("id, name, lat, lng, resource_id").eq("trip_id", tripId),
      admin.from("planner_days").select("id, date").eq("trip_id", tripId).order("date", { ascending: true }),
      admin.from("planner_memberships").select("planner_users(id, phone)").eq("trip_id", tripId),
      admin.from("planner_preferences").select("user_id").eq("trip_id", tripId),
    ]);

  const places = placeRows ?? [];
  const keptResourceIds = new Set(places.filter((p) => p.resource_id).map((p) => p.resource_id as string));
  const emptyResourceCount = (resourceRows ?? []).filter((r) => !keptResourceIds.has(r.id)).length;
  if (emptyResourceCount >= 2) {
    items.push({
      kind: "review_links",
      label: `${emptyResourceCount} links didn't keep a place`,
      cta: `Review ${emptyResourceCount} links`,
      href: `/planner/trips/${tripId}#resources`,
      severity: "normal",
    });
  }

  const unlocated = places.find((p) => p.lat == null || p.lng == null);
  if (unlocated) {
    items.push({
      kind: "locate_place",
      label: `"${unlocated.name}" doesn't have a location yet`,
      cta: `Locate ${unlocated.name}`,
      href: `/planner/trips/${tripId}#places`,
      severity: "normal",
    });
  }

  if (dayRows && dayRows.length > 0) {
    const dayIds = dayRows.map((d) => d.id);
    const { data: itemRows } = await admin
      .from("planner_itinerary_items")
      .select("day_id")
      .in("day_id", dayIds);
    const itemCounts = new Map<string, number>();
    for (const i of itemRows ?? []) itemCounts.set(i.day_id, (itemCounts.get(i.day_id) ?? 0) + 1);

    let runStart = -1;
    for (let i = 0; i < dayRows.length; i++) {
      const empty = (itemCounts.get(dayRows[i].id) ?? 0) === 0;
      if (empty && runStart === -1) runStart = i;
      if (!empty) runStart = -1;
      if (empty && runStart !== -1 && i - runStart >= 1) {
        const weekday = WEEKDAYS[new Date(dayRows[runStart].date + "T00:00:00").getDay()];
        items.push({
          kind: "draft_day",
          label: "A couple of days in a row have nothing planned",
          cta: `Draft ${weekday}`,
          href: `/planner/trips/${tripId}#itinerary`,
          severity: "normal",
        });
        break;
      }
    }
  }

  const membersWithPhone = (memberRows ?? [])
    .map((m) => m.planner_users as unknown as { id: string; phone: string | null } | null)
    .filter((m): m is { id: string; phone: string | null } => Boolean(m?.phone));
  const answeredIds = new Set((prefRows ?? []).map((p) => p.user_id));
  const missingPrefs = membersWithPhone.filter((m) => !answeredIds.has(m.id)).length;
  if (missingPrefs > 0) {
    items.push({
      kind: "nudge_prefs",
      label: `${missingPrefs} ${missingPrefs === 1 ? "person hasn't" : "people haven't"} submitted preferences`,
      cta: `Nudge ${missingPrefs}`,
      href: `/planner/trips/${tripId}/preferences`,
      severity: "normal",
    });
  }

  const capped = items.slice(0, 3);
  return { items: capped, primary: capped[0] ?? null };
}
