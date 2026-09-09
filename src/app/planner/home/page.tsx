import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeHomeAttention } from "@/lib/planner/homeAttention";
import { HomeNav } from "@/components/planner/HomeNav";
import { signOut } from "../actions";

function formatDates(start: string | null, end: string | null) {
  if (!start) return "No dates yet";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(start + "T00:00:00").toLocaleDateString(undefined, opts);
  if (!end) return s;
  const e = new Date(end + "T00:00:00").toLocaleDateString(undefined, opts);
  return `${s}–${e}`;
}

function stageOf(trip: { start_date: string | null; end_date: string | null; dates_locked_at: string | null }, today: string) {
  if (trip.end_date && trip.end_date < today) return "Past" as const;
  if (trip.dates_locked_at) return "Booked" as const;
  if (trip.start_date) return "In planning" as const;
  return "Idea" as const;
}

const STAGE_COLOR: Record<string, string> = {
  Idea: "var(--color-ink-muted)",
  "In planning": "var(--color-accent)",
  Booked: "var(--color-positive)",
  Past: "var(--color-ink-faint)",
};

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

export default async function HomePage() {
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  const admin = createAdminClient();

  const { data: membershipRows } = await admin
    .from("planner_memberships")
    .select("role, planner_trips(id, name, destination, start_date, end_date, dates_locked_at)")
    .eq("user_id", user.id);

  const memberships = (membershipRows ?? [])
    .map((m) => ({
      role: m.role as string,
      trip: m.planner_trips as unknown as {
        id: string;
        name: string;
        destination: string | null;
        start_date: string | null;
        end_date: string | null;
        dates_locked_at: string | null;
      } | null,
    }))
    .filter((m): m is { role: string; trip: NonNullable<typeof m.trip> } => Boolean(m.trip));

  const today = new Date().toISOString().slice(0, 10);
  const tripIds = memberships.map((m) => m.trip.id);

  const planningTripIds = memberships
    .filter((m) => !m.trip.dates_locked_at && (!m.trip.end_date || m.trip.end_date >= today))
    .map((m) => m.trip.id);
  const [{ data: memberCountRows }, { data: markRows }] =
    planningTripIds.length > 0
      ? await Promise.all([
          admin.from("planner_memberships").select("trip_id").in("trip_id", planningTripIds),
          admin.from("planner_availability_marks").select("trip_id, user_id").in("trip_id", planningTripIds),
        ])
      : [{ data: [] }, { data: [] }];
  const totalByTrip = new Map<string, number>();
  for (const r of memberCountRows ?? []) totalByTrip.set(r.trip_id, (totalByTrip.get(r.trip_id) ?? 0) + 1);
  const answeredSetByTrip = new Map<string, Set<string>>();
  for (const r of markRows ?? []) {
    const set = answeredSetByTrip.get(r.trip_id) ?? new Set<string>();
    set.add(r.user_id);
    answeredSetByTrip.set(r.trip_id, set);
  }

  const tripPreviews = [...memberships]
    .sort((a, b) => (a.trip.start_date ?? "9999-99-99").localeCompare(b.trip.start_date ?? "9999-99-99"))
    .slice(0, 3)
    .map(({ trip, role }) => {
      const stage = stageOf(trip, today);
      const status =
        stage === "Idea"
          ? "Just an idea so far"
          : stage === "In planning"
            ? `${answeredSetByTrip.get(trip.id)?.size ?? 0} of ${totalByTrip.get(trip.id) ?? 0} answered`
            : stage === "Booked"
              ? "All set"
              : "Trip wrapped";
      return {
        id: trip.id,
        title: trip.name,
        place: trip.destination ?? "Somewhere",
        dates: formatDates(trip.start_date, trip.end_date),
        status,
        stage,
        role,
      };
    });

  const attention = await computeHomeAttention(admin, user.id);

  const { data: followRows } = await admin.from("planner_follows").select("followee_id").eq("follower_id", user.id);
  const followeeIds = (followRows ?? []).map((r) => r.followee_id as string);
  const fourteenDaysAgo = new Date(new Date().getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { count: exploreCount } =
    followeeIds.length > 0
      ? await admin
          .from("planner_trips")
          .select("id", { count: "exact", head: true })
          .in("created_by", followeeIds)
          .eq("is_public", true)
          .gte("created_at", fourteenDaysAgo)
      : { count: 0 };

  const { count: savedPlacesCount } = await admin
    .from("planner_saved_places")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const { count: savedTripsCount } = await admin
    .from("planner_trip_saves")
    .select("trip_id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const savedCount = (savedPlacesCount ?? 0) + (savedTripsCount ?? 0);

  const smsNumber = process.env.TWILIO_SMS_NUMBER ?? null;

  const firstName = (user.name || user.email || "there").split(/[\s@]/)[0];
  const label = user.name || user.email || "?";

  return (
    <div className="min-h-screen">
      <HomeNav
        initial={initialsOf(label)}
        username={user.username}
        tripsCount={tripIds.length}
        savedCount={savedCount}
        signOutAction={signOut}
      />

      <div className="mx-auto max-w-[1180px] px-8 py-12 pb-24">
        <div className="mb-9.5">
          <h1 className="mb-2 text-[46px] leading-[1.05] font-display tracking-tight text-ink">Morning, {firstName}.</h1>
          <p className="text-[16.5px] text-body">
            {attention.length === 0
              ? "Nothing is waiting on you."
              : `${attention.length} thing${attention.length === 1 ? "" : "s"} ${attention.length === 1 ? "is" : "are"} waiting on you.`}
          </p>
        </div>

        <div className="mb-11">
          <p className="mb-3.5 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Needs you</p>
          {attention.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-input-border p-6.5 text-center text-[15px] text-muted">
              Nothing needs you right now.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {attention.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-4.5 rounded-2xl border border-warm-border bg-warm-bg px-5 py-4.5"
                >
                  <span
                    className="h-2.5 w-2.5 flex-none rounded-full"
                    style={{ background: item.urgent ? "var(--color-accent)" : "var(--color-accent-tint)" }}
                  />
                  <div className="min-w-[220px] flex-1">
                    <div className="mb-0.5 text-[16.5px] text-ink">{item.title}</div>
                    <div className="text-[14px] text-muted">{item.meta}</div>
                  </div>
                  <Link
                    href={item.href}
                    className="flex-none rounded-full bg-accent px-5 py-2.5 text-[14px] text-on-accent hover:opacity-90"
                  >
                    {item.action}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-11">
          <div className="mb-3.5 flex items-baseline justify-between gap-4">
            <p className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Your trips</p>
            <Link href="/planner/trips" className="text-[14px] text-body hover:text-accent">
              All trips &rarr;
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {tripPreviews.map((t) => (
              <Link
                key={t.id}
                href={`/planner/trips/${t.id}`}
                className="flex flex-wrap items-center gap-5 border-b border-border-soft px-5.5 py-4.5 hover:bg-surface-sunk"
              >
                <div className="min-w-[200px] flex-1">
                  <div className="mb-0.5 font-display text-[23px] leading-[1.15] text-ink">{t.title}</div>
                  <div className="font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">{t.place}</div>
                </div>
                <div className="w-[150px] text-[14.5px] text-body">{t.dates}</div>
                <div className="w-[180px] text-[14px] text-muted">{t.status}</div>
                <span
                  className="flex-none rounded-full px-2.5 py-1 font-mono text-[9.5px] tracking-[0.1em] uppercase"
                  style={{ border: `1px solid ${STAGE_COLOR[t.stage]}`, color: STAGE_COLOR[t.stage] }}
                >
                  {t.stage}
                </span>
              </Link>
            ))}
            <Link
              href="/planner/trips/new"
              className="flex items-center gap-3 px-5.5 py-4 text-[15px] text-muted hover:text-ink"
            >
              <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full border border-dashed border-input-border text-[13px] text-faint">
                +
              </span>
              Start another trip
            </Link>
          </div>
        </div>

        <div>
          <p className="mb-3.5 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Where to next</p>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Link href="/planner/explore" className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-5.5">
              <span className="font-mono text-[10px] tracking-[0.12em] text-accent uppercase">Explore</span>
              <span className="font-display text-[25px] leading-[1.15] text-ink">See where friends went</span>
              <span className="text-[14.5px] leading-relaxed text-muted">
                {exploreCount && exploreCount > 0
                  ? `${exploreCount} new trip${exploreCount === 1 ? "" : "s"} from people you follow, with the places they rated.`
                  : "Trips from people you follow, with the places they rated."}
              </span>
            </Link>
            <Link href="/planner/trips?tab=saved" className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-5.5">
              <span className="font-mono text-[10px] tracking-[0.12em] text-accent uppercase">Saved</span>
              <span className="font-display text-[25px] leading-[1.15] text-ink">
                {savedPlacesCount && savedPlacesCount > 0
                  ? `${savedPlacesCount} place${savedPlacesCount === 1 ? "" : "s"}, no trip yet`
                  : "Nothing saved yet"}
              </span>
              <span className="text-[14.5px] leading-relaxed text-muted">
                Spots you kept from other people&rsquo;s trips. Drop one onto a day.
              </span>
            </Link>
            <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-5.5">
              <span className="font-mono text-[10px] tracking-[0.12em] text-accent uppercase">Text it in</span>
              <span className="font-display text-[25px] leading-[1.15] text-ink">Forward a link, any time</span>
              <span className="text-[14.5px] leading-relaxed text-muted">
                {smsNumber
                  ? `Send a recommendation to ${smsNumber} and it lands on the right trip.`
                  : "Forward a recommendation and it lands on the right trip."}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
