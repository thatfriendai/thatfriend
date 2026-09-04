import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { FollowButton } from "./FollowButton";
import { CopyTripButton } from "./CopyTripButton";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDates(start: string | null, end: string | null) {
  if (!start) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(start + "T00:00:00").toLocaleDateString(undefined, opts).toUpperCase();
  if (!end) return s;
  const e = new Date(end + "T00:00:00").toLocaleDateString(undefined, opts).toUpperCase();
  return `${s}–${e}`;
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const viewer = await getPlannerUser();
  const admin = createAdminClient();

  const { data: profileUser } = await admin
    .from("planner_users")
    .select("id, name, username, tagline")
    .eq("username", username)
    .maybeSingle();
  if (!profileUser) notFound();

  const isSelf = viewer?.id === profileUser.id;

  const { data: memberships } = await admin
    .from("planner_memberships")
    .select(
      "trip_id, planner_trips(id, name, destination, start_date, end_date, is_public, dates_locked_at)"
    )
    .eq("user_id", profileUser.id);

  const allTrips = (memberships ?? [])
    .map(
      (m) =>
        m.planner_trips as unknown as {
          id: string;
          name: string;
          destination: string | null;
          start_date: string | null;
          end_date: string | null;
          is_public: boolean;
          dates_locked_at: string | null;
        } | null
    )
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const visibleTrips = isSelf ? allTrips : allTrips.filter((t) => t.is_public);

  const today = new Date().toISOString().slice(0, 10);
  const nextTrip =
    visibleTrips
      .filter((t) => t.start_date && (!t.end_date || t.end_date >= today))
      .sort((a, b) => (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999"))[0] ?? null;
  const pastTrips = visibleTrips
    .filter((t) => t.id !== nextTrip?.id)
    .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));

  const nightsAway = visibleTrips.reduce((sum, t) => {
    if (!t.start_date || !t.end_date) return sum;
    return sum + Math.max(0, Math.round((Date.parse(t.end_date) - Date.parse(t.start_date)) / 86400000));
  }, 0);
  const destinations = new Set(visibleTrips.map((t) => t.destination).filter(Boolean));

  const { count: friendCount } = await admin
    .from("planner_follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("followee_id", profileUser.id);

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

  const { data: followingRows } = await admin
    .from("planner_follows")
    .select("followee_id, planner_users!planner_follows_followee_id_fkey(name, username)")
    .eq("follower_id", profileUser.id)
    .limit(12);
  const friends = (followingRows ?? [])
    .map((f) => f.planner_users as unknown as { name: string | null; username: string | null } | null)
    .filter((f): f is NonNullable<typeof f> => Boolean(f?.username));

  const label = profileUser.name || `@${profileUser.username}`;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-card px-5 py-5 sm:px-10">
        <Link href="/planner/trips" className="text-[23px] tracking-tight font-display text-ink">
          &ldquo;that friend&rdquo;
        </Link>
        {isSelf && (
          <Link href="/planner/profile" className="text-[13.5px] text-body hover:text-accent">
            Edit profile
          </Link>
        )}
      </header>

      <div className="mx-auto max-w-[760px] px-6 py-13 pb-28">
        <div className="mb-12 flex items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <div
              className="flex h-16 w-16 flex-none items-center justify-center rounded-full text-[20px] text-cream"
              style={{ background: "#8A5A7A" }}
            >
              {initialsOf(label)}
            </div>
            <div>
              <h1 className="mb-1 text-[32px] leading-[1.1] font-display tracking-tight text-ink">
                {profileUser.name || `@${profileUser.username}`}
              </h1>
              {profileUser.tagline && <p className="mb-3 text-[14px] text-muted">{profileUser.tagline}</p>}
              <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[12px] text-body">
                <div>
                  <span className="text-[15px] font-medium text-ink">{visibleTrips.length}</span> trips
                </div>
                <div>
                  <span className="text-[15px] font-medium text-ink">{destinations.size}</span> places
                </div>
                <div>
                  <span className="text-[15px] font-medium text-ink">{nightsAway}</span> nights away
                </div>
                <div>
                  <span className="text-[15px] font-medium text-ink">{friendCount ?? 0}</span> friends
                </div>
              </div>
            </div>
          </div>
          {!isSelf && viewer && <FollowButton username={username} initialFollowing={isFollowing} />}
        </div>

        {nextTrip && (
          <div className="mb-10 rounded-2xl border border-warm-border bg-warm-bg p-5">
            <p className="mb-1 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">Coming up</p>
            <p className="mb-0.5 text-[16px] font-medium text-ink">{nextTrip.name}</p>
            <p className="font-mono text-[11px] text-muted">
              {formatDates(nextTrip.start_date, nextTrip.end_date) ?? "Dates open"}
              {nextTrip.destination ? ` · ${nextTrip.destination}` : ""}
            </p>
          </div>
        )}

        <div className="mb-12">
          <p className="mb-4 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
            {isSelf ? "Your trips" : "Public trips"} &middot; {pastTrips.length}
          </p>
          {pastTrips.length === 0 ? (
            <p className="text-[14px] text-muted">Nothing public yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pastTrips.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-card px-5 py-4">
                  <div className="mb-1.5 flex items-baseline justify-between gap-4">
                    <span className="font-display text-[19px] text-ink">{t.name}</span>
                    <span className="font-mono text-[10.5px] text-muted">
                      {formatDates(t.start_date, t.end_date) ?? "Dates open"}
                    </span>
                  </div>
                  {t.destination && <p className="mb-3 text-[13px] text-muted">{t.destination}</p>}
                  <div className="flex items-center gap-3">
                    {!isSelf && <CopyTripButton tripId={t.id} />}
                    <Link
                      href={`/planner/trips/${t.id}`}
                      className="rounded-full border border-input-border bg-card px-4 py-2 text-[12.5px] text-ink hover:border-ink"
                    >
                      {isSelf ? "Open" : "See the trip"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {friends.length > 0 && (
          <div>
            <p className="mb-4 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">Friends</p>
            <div className="flex flex-col gap-2.5">
              {friends.map((f) => (
                <Link
                  key={f.username}
                  href={`/planner/u/${f.username}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-input-border"
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] text-cream"
                    style={{ background: "#6E8C6A" }}
                  >
                    {initialsOf(f.name || f.username || "?")}
                  </div>
                  <span className="text-[14px] text-ink-soft">{f.name || `@${f.username}`}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
