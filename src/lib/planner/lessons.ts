import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Lesson {
  id: string;
  userId: string;
  who: string;
  body: string;
}

function labelOf(person: { name: string | null; email: string | null } | null) {
  return person?.name?.split(" ")[0] || person?.email?.split("@")[0] || "Someone";
}

/** Every "what would you do differently" line saved on one trip, oldest first. */
export async function listLessons(admin: SupabaseClient, tripId: string): Promise<Lesson[]> {
  const { data } = await admin
    .from("planner_trip_lessons")
    .select("id, user_id, body, planner_users(name, email)")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((l) => ({
    id: l.id,
    userId: l.user_id,
    body: l.body,
    who: labelOf(l.planner_users as unknown as { name: string | null; email: string | null } | null),
  }));
}

/**
 * "Last time · Mallorca, May" on a trip being planned: the lessons from the
 * most recent finished trip that shares at least two of this trip's
 * members — i.e. the same group, not just the same organizer. Null when
 * there's no such trip, or it has no lessons saved.
 */
export async function lastTimeFor(
  admin: SupabaseClient,
  tripId: string
): Promise<{ tripId: string; label: string; lessons: Lesson[] } | null> {
  const { data: members } = await admin.from("planner_memberships").select("user_id").eq("trip_id", tripId);
  const memberIds = (members ?? []).map((m) => m.user_id as string);
  if (memberIds.length < 2) return null;

  const { data: overlap } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .in("user_id", memberIds)
    .neq("trip_id", tripId);
  const shared = new Map<string, number>();
  for (const m of overlap ?? []) shared.set(m.trip_id, (shared.get(m.trip_id) ?? 0) + 1);
  const candidates = [...shared.entries()].filter(([, n]) => n >= 2).map(([id]) => id);
  if (candidates.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const { data: past } = await admin
    .from("planner_trips")
    .select("id, name, destination, end_date")
    .in("id", candidates)
    .lt("end_date", today)
    .order("end_date", { ascending: false })
    .limit(5);

  for (const t of past ?? []) {
    const lessons = await listLessons(admin, t.id);
    if (lessons.length === 0) continue;
    const place = (t.destination ?? t.name).split(",")[0];
    const month = new Date(t.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "long" });
    return { tripId: t.id, label: `${place}, ${month}`, lessons };
  }
  return null;
}
