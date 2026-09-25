import { notFound, redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { PreferencesForm } from "./PreferencesForm";
import { DAY_COLORS } from "@/lib/planner/itinerary";
import { formatDateRange } from "@/lib/planner/calendarDate";

const AVATAR_COLORS = DAY_COLORS;

function initialsOf(name: string) {
  return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export default async function PreferencesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) redirect(`/planner/login`);

  const admin = createAdminClient();

  // None of these six depend on each other — one round trip instead of
  // six sequential ones.
  const [
    { data: membership },
    { data: trip },
    { data: myPref },
    { data: myAvailability },
    { data: memberRows, error: memberRowsError },
    { data: allPrefs },
  ] = await Promise.all([
    admin.from("planner_memberships").select("role").eq("trip_id", tripId).eq("user_id", user.id).eq("status", "active").maybeSingle(),
    admin.from("planner_trips").select("*, planner_users!planner_trips_created_by_fkey(name, email)").eq("id", tripId).maybeSingle(),
    admin.from("planner_preferences").select("*").eq("trip_id", tripId).eq("user_id", user.id).maybeSingle(),
    admin.from("planner_availability_marks").select("date").eq("trip_id", tripId).eq("user_id", user.id),
    // Explicit FK name: planner_memberships has two relationships to
    // planner_users (user_id, and removed_by) — without the hint PostgREST
    // fails the query (PGRST201) and the answered-dots row goes empty.
    admin
      .from("planner_memberships")
      .select("planner_users!planner_memberships_user_id_fkey(id, name, email)")
      .eq("trip_id", tripId)
      .eq("status", "active"),
    admin.from("planner_preferences").select("user_id, stay_max, flight_max, food_max, non_negotiable").eq("trip_id", tripId),
  ]);
  if (!membership) notFound();
  if (!trip) notFound();
  if (memberRowsError) console.error("[preferences page] roster query failed", tripId, memberRowsError);

  const starter = trip.planner_users as unknown as { name: string | null; email: string | null } | null;
  const answeredIds = new Set((allPrefs ?? []).map((p) => p.user_id));
  const members = (memberRows ?? [])
    .map((m) => m.planner_users as unknown as { id: string; name: string | null; email: string | null } | null)
    .filter((m): m is { id: string; name: string | null; email: string | null } => Boolean(m));

  const answerDots = members.map((m, i) => ({
    initials: initialsOf(m.name || m.email?.split("@")[0] || "?"),
    answered: answeredIds.has(m.id),
    color: AVATAR_COLORS[i % AVATAR_COLORS.length],
  }));

  const openAnswers =
    trip.privacy === "open"
      ? members
          .map((m) => {
            const p = (allPrefs ?? []).find((a) => a.user_id === m.id);
            if (!p) return null;
            return {
              name: m.name || m.email?.split("@")[0] || "Someone",
              budget:
                p.stay_max || p.flight_max
                  ? `$${p.stay_max ?? "–"} / nt · $${p.flight_max ?? "–"} fl`
                  : "",
              note: p.non_negotiable || "",
            };
          })
          .filter((a): a is NonNullable<typeof a> => Boolean(a))
      : [];

  const dateRange =
    trip.start_date && trip.end_date
      ? formatDateRange(trip.start_date, trip.end_date, { month: "long", separator: " – " })
      : null;

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_400px]">
      <div className="max-w-[780px] px-6 py-13 pb-24 sm:px-15">
        <p className="mb-3.5 font-mono text-[11.5px] tracking-[0.14em] text-muted uppercase">
          Your preferences for {trip.name}
        </p>
        <h1 className="mb-3 text-[46px] leading-[1.08] font-display tracking-tight text-ink">
          What would make this trip good for you?
        </h1>
        <p className="mb-11 max-w-xl text-base leading-relaxed text-body">
          {trip.privacy === "private"
            ? "Nobody sees what you put — say the real number."
            : "Everyone can see answers as they come in on this trip."}
        </p>

        <PreferencesForm
          tripId={tripId}
          initial={myPref}
          isPrivate={trip.privacy === "private"}
          datesLocked={Boolean(trip.dates_locked_at)}
          initialAvailableDates={(myAvailability ?? []).map((d) => d.date)}
        />
      </div>

      <aside className="flex flex-col gap-6.5 border-l border-border bg-card px-7.5 py-8.5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div>
          <p className="mb-3.5 font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
            The trip
          </p>
          <p className="text-[26px] leading-tight font-display text-ink">{trip.name}</p>
          {dateRange && <p className="mt-1.5 text-sm text-body">{dateRange}</p>}
          <p className="mt-0.5 text-sm text-muted">
            Started by {starter?.name || starter?.email?.split("@")[0] || "someone"}
          </p>
        </div>

        <div className="border-t border-border-soft pt-5.5">
          <div className="mb-3.5 flex items-baseline justify-between">
            <p className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
              Answered
            </p>
            <p className="text-[12.5px] text-faint">
              {answeredIds.size} of {members.length}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {answerDots.map((d, i) => (
              <div
                key={i}
                className="flex h-7.5 w-7.5 items-center justify-center rounded-full text-[10.5px] text-cream"
                style={{
                  background: d.answered ? d.color : "#EDE8DD",
                  color: d.answered ? undefined : "var(--color-ink-muted)",
                }}
              >
                {d.initials}
              </div>
            ))}
          </div>

          {trip.privacy === "private" ? (
            <p className="mt-3.5 text-[13.5px] leading-relaxed text-muted">
              Nobody sees anyone else&rsquo;s answers, including yours. When
              the last person is in, everyone gets the overlap at once.
            </p>
          ) : (
            <>
              <p className="mt-3.5 text-[13.5px] leading-relaxed text-muted">
                {starter?.name || "The trip starter"} set this trip to open,
                so everyone&rsquo;s answers are visible as they come in.
              </p>
              {openAnswers.length > 0 && (
                <div className="mt-4 flex flex-col gap-3">
                  {openAnswers.map((a, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border-soft bg-card p-3.5"
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-sm font-medium text-ink">{a.name}</span>
                        {a.budget && (
                          <span className="ml-auto font-mono text-[11px] text-faint">
                            {a.budget}
                          </span>
                        )}
                      </div>
                      {a.note && (
                        <p className="text-[13.5px] leading-relaxed text-body">{a.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {trip.privacy === "private" && (
          <div className="rounded-2xl border border-warm-border bg-warm-bg p-5">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="h-4.5 w-4.5 rounded-[5px] bg-accent" />
              <p className="font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
                Why the real number
              </p>
            </div>
            <p className="text-sm leading-relaxed text-body">
              Your budget never shows up next to your name. It becomes one
              dot in a range, and the range is what the group plans against.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
