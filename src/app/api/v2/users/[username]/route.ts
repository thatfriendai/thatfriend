import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { listFriends } from "@/lib/planner/follows";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const viewer = await getPlannerUser();
  const admin = createAdminClient();

  const { data: profileUser } = await admin
    .from("planner_users")
    .select("id, name, username, tagline, is_public")
    .eq("username", username)
    .maybeSingle();
  if (!profileUser) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const isSelfCheck = viewer?.id === profileUser.id;
  if (!profileUser.is_public && !isSelfCheck) {
    return NextResponse.json({ error: "This profile is private." }, { status: 403 });
  }

  const { data: memberships } = await admin
    .from("planner_memberships")
    .select("trip_id, planner_trips(id, name, destination, start_date, end_date, is_public, dates_locked_at)")
    .eq("user_id", profileUser.id);

  const allTrips = (memberships ?? [])
    .map((m) => m.planner_trips as unknown as {
      id: string; name: string; destination: string | null;
      start_date: string | null; end_date: string | null;
      is_public: boolean; dates_locked_at: string | null;
    } | null)
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const isSelf = viewer?.id === profileUser.id;
  const publicTrips = isSelf ? allTrips : allTrips.filter((t) => t.is_public);

  const nightsAway = publicTrips.reduce((sum, t) => {
    if (!t.start_date || !t.end_date) return sum;
    const nights = Math.round(
      (Date.parse(t.end_date) - Date.parse(t.start_date)) / 86400000
    );
    return sum + Math.max(0, nights);
  }, 0);
  const destinations = new Set(publicTrips.map((t) => t.destination).filter(Boolean));

  const friends = await listFriends(admin, profileUser.id);

  let isFollowing = false;
  if (viewer && !isSelf) {
    const { data: followRow } = await admin
      .from("planner_follows")
      .select("follower_id")
      .eq("follower_id", viewer.id)
      .eq("followee_id", profileUser.id)
      .maybeSingle();
    isFollowing = Boolean(followRow);
  }

  const nextTrip = publicTrips
    .filter((t) => !t.dates_locked_at || (t.end_date && t.end_date >= new Date().toISOString().slice(0, 10)))
    .sort((a, b) => (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999"))[0] ?? null;

  return NextResponse.json({
    user: { name: profileUser.name, username: profileUser.username, tagline: profileUser.tagline },
    stats: { trips: publicTrips.length, destinations: destinations.size, nightsAway, friends: friends.length },
    trips: publicTrips
      .filter((t) => t.id !== nextTrip?.id)
      .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? "")),
    nextTrip,
    isSelf,
    isFollowing,
  });
}
