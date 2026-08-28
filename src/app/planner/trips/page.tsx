import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/planner/actions";

function formatDates(start: string | null, end: string | null) {
  if (!start) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(start).toLocaleDateString(undefined, opts).toUpperCase();
  if (!end) return s;
  const e = new Date(end).toLocaleDateString(undefined, opts).toUpperCase();
  return `${s}–${e}`;
}

export default async function PlannerTripsPage() {
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("planner_memberships")
    .select(
      "role, planner_trips(id, name, destination, start_date, end_date)"
    )
    .eq("user_id", user.id);

  const trips = (memberships ?? [])
    .map((m) => ({
      role: m.role,
      trip: m.planner_trips as unknown as {
        id: string;
        name: string;
        destination: string | null;
        start_date: string | null;
        end_date: string | null;
      } | null,
    }))
    .filter((x): x is { role: string; trip: NonNullable<typeof x.trip> } => Boolean(x.trip));

  const firstName = (user.name || user.email || "there").split(/[\s@]/)[0];
  const initial = (user.name || user.email || "?").trim()[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-y-3 border-b border-border bg-card px-5 py-5 sm:px-10">
        <span className="text-[23px] tracking-tight font-display text-ink">
          &ldquo;that friend&rdquo;
        </span>
        <div className="flex items-center gap-3.5 sm:gap-5">
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
          <div className="flex h-7.5 w-7.5 items-center justify-center rounded-full bg-[#C9A227] text-xs text-ink">
            {initial}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1000px] px-6 py-15 pb-28">
        <h1 className="mb-2 text-[42px] leading-[1.06] font-display tracking-tight text-ink">
          Morning, {firstName}.
        </h1>
        <p className="mb-13 text-base text-body">
          {trips.length === 0
            ? "No trips yet — start the one you keep talking about."
            : `${trips.length} trip${trips.length === 1 ? "" : "s"} you're part of.`}
        </p>

        {trips.length > 0 && (
          <div className="mb-11">
            {trips.map(({ trip, role }) => (
              <Link
                key={trip.id}
                href={`/planner/trips/${trip.id}`}
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
                  {role === "owner" ? "You're organizing" : "You're in"}
                </p>
              </Link>
            ))}
          </div>
        )}

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
