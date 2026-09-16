import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeHomeAttention, computeTripsToRate } from "@/lib/planner/homeAttention";
import { HomeNav } from "@/components/planner/HomeNav";
import { GUIDES, TYPE_COLORS, TYPE_WASH } from "@/lib/planner/guides";
import { tintFor } from "@/lib/planner/cover";
import { signOut } from "../actions";
import { TextItInBar } from "./TextItInBar";

function formatDates(start: string | null, end: string | null) {
  if (!start) return null;
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

// The three featured guides on Home. No real "trending" signal exists (no
// view/clone analytics), so this doesn't claim one — it just surfaces real,
// already-written guide content rather than fabricating trending copy.
const FEATURED_GUIDES = GUIDES.slice(0, 3);

export default async function HomePage() {
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  const admin = createAdminClient();

  // None of these three depend on each other.
  const [{ data: membershipRows }, attention, tripsToRate] = await Promise.all([
    admin
      .from("planner_memberships")
      .select("role, planner_trips(id, name, destination, start_date, end_date, dates_locked_at)")
      .eq("user_id", user.id),
    computeHomeAttention(admin, user.id),
    computeTripsToRate(admin, user.id),
  ]);

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

  const { data: memberCountRows } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .in("trip_id", tripIds.length > 0 ? tripIds : ["00000000-0000-0000-0000-000000000000"]);
  const travelerCountByTrip = new Map<string, number>();
  for (const r of memberCountRows ?? []) {
    travelerCountByTrip.set(r.trip_id, (travelerCountByTrip.get(r.trip_id) ?? 0) + 1);
  }

  const rateItemByTripId = new Map(tripsToRate.map((item) => [item.id.replace(/^rate-/, ""), item]));

  const tripCards = [...memberships]
    .sort((a, b) => (a.trip.start_date ?? "9999-99-99").localeCompare(b.trip.start_date ?? "9999-99-99"))
    .map(({ trip }) => {
      const stage = stageOf(trip, today);
      const rateItem = rateItemByTripId.get(trip.id);
      const cta =
        stage === "Idea"
          ? { label: "Add dates", href: `/planner/trips/${trip.id}/dates` }
          : stage === "In planning"
            ? { label: "Add places", href: `/planner/trips/${trip.id}#places` }
            : stage === "Booked"
              ? { label: "View itinerary", href: `/planner/trips/${trip.id}#itinerary` }
              : rateItem
                ? { label: rateItem.action, href: rateItem.href }
                : null;
      const travelerCount = travelerCountByTrip.get(trip.id) ?? 1;
      return {
        id: trip.id,
        title: trip.name,
        place: trip.destination ?? "Somewhere",
        dates: formatDates(trip.start_date, trip.end_date) ?? "No dates yet",
        travelers: travelerCount === 1 ? "Just you" : `${travelerCount} travellers`,
        cta,
        tint: tintFor(trip.id),
      };
    });

  const smsNumber = process.env.TWILIO_SMS_NUMBER ?? null;

  const firstName = (user.name || user.email || "there").split(/[\s@]/)[0];
  const label = user.name || user.email || "?";

  return (
    <div className="min-h-screen">
      <HomeNav initial={initialsOf(label)} username={user.username} tripsCount={tripIds.length} signOutAction={signOut} />

      <div className="mx-auto max-w-[1180px] px-8 py-12 pb-24">
        <h1 className="mb-7 text-[46px] leading-[1.05] font-display tracking-tight text-ink">Hi, {firstName}.</h1>

        {attention.length > 0 && (
          <div className="mb-7 flex flex-col gap-3">
            {attention.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-4.5 rounded-2xl border border-warm-border bg-warm-bg px-5 py-4.5"
              >
                <span className="h-2.5 w-2.5 flex-none rounded-full bg-accent" />
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

        <div className="mb-4.5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tripCards.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-4.5 rounded-[18px] border px-6.5 py-6.5 pb-5.5"
              style={{ borderColor: `${t.tint}33`, borderTop: `3px solid ${t.tint}`, background: "var(--color-card)" }}
            >
              <div>
                <div className="mb-2 font-mono text-[10.5px] tracking-[0.1em] uppercase" style={{ color: t.tint }}>
                  {t.place}
                </div>
                <Link href={`/planner/trips/${t.id}`} className="block font-display text-[34px] leading-[1.1] tracking-tight text-ink">
                  {t.title}
                </Link>
              </div>

              <div className="flex flex-col gap-2.5 rounded-[11px] px-3.5 py-3.5" style={{ background: `${t.tint}0F` }}>
                <div className="flex items-baseline gap-3">
                  <span className="w-[78px] flex-none font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Dates</span>
                  <span className="text-[15px] text-body">{t.dates}</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="w-[78px] flex-none font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Travellers</span>
                  <span className="text-[15px] text-body">{t.travelers}</span>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                {t.cta && (
                  <Link
                    href={t.cta.href}
                    className="flex-none rounded-full px-5.5 py-2.5 text-[14.5px] text-cream hover:opacity-90"
                    style={{ background: t.tint }}
                  >
                    {t.cta.label}
                  </Link>
                )}
                <Link href={`/planner/trips/${t.id}`} className="text-[14.5px] text-body hover:text-accent">
                  Open trip &rarr;
                </Link>
              </div>
            </div>
          ))}

          <Link
            href="/planner/trips/new"
            className="flex min-h-[180px] flex-col justify-center gap-2 rounded-[18px] border border-dashed border-input-border px-6.5 py-6.5 text-muted hover:border-ink"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-input-border text-[15px] text-faint">
              +
            </span>
            <span className="font-display text-[26px] leading-[1.15] text-ink">Start another trip</span>
            <span className="text-[14.5px] leading-relaxed">A city and a name is enough. Dates can come later.</span>
          </Link>
        </div>

        <TextItInBar smsNumber={smsNumber} />

        <section>
          <div className="mb-1.5 flex items-baseline justify-between gap-4">
            <p className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">From the guides</p>
            <Link href="/planner/explore" className="text-[14px] text-body hover:text-accent">
              All guides &rarr;
            </Link>
          </div>
          <p className="mb-4.5 text-[14.5px] text-muted">
            Editorially written place lists you can copy straight into a trip.
          </p>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_GUIDES.map((g) => (
              <Link
                key={g.id}
                href={`/planner/explore?guide=${g.id}`}
                className="flex flex-col gap-2 rounded-2xl border px-5.5 py-5.5 pb-5"
                style={{ background: TYPE_WASH[g.type], borderColor: `${TYPE_COLORS[g.type]}33` }}
              >
                <span
                  className="font-mono text-[10.5px] tracking-[0.1em] uppercase"
                  style={{ color: TYPE_COLORS[g.type] }}
                >
                  {g.type}
                </span>
                <span className="font-display text-[28px] leading-[1.1] text-ink">{g.city.split(",")[0]}</span>
                <span className="text-[14.5px] leading-[1.5] text-body text-pretty">{g.blurb}</span>
                <span
                  className="mt-1 border-t pt-3 font-mono text-[10.5px] tracking-[0.08em] uppercase"
                  style={{ borderColor: `${TYPE_COLORS[g.type]}33`, color: TYPE_COLORS[g.type] }}
                >
                  {g.places.length} places &rarr;
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
