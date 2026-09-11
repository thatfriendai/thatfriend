import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUDGET_FIELDS } from "@/lib/planner/preferences";
import { computeOverlap, computeClusters, type ConvergenceOverlap } from "@/lib/planner/convergence";
import { generateConvergenceReads } from "@/lib/planner/narrative";
import { DAY_COLORS } from "@/lib/planner/itinerary";

const DOT_COLORS = DAY_COLORS;

function OverlapBar({ overlap }: { overlap: ConvergenceOverlap }) {
  const pct = (v: number) => Math.min(98, (v / overlap.max) * 100);
  const floorPct = pct(overlap.floor);
  const comfyPct = pct(overlap.comfy);

  // Tied values fan sideways rather than stacking exactly on top of each other.
  const seen = new Map<number, number>();
  const positioned = overlap.dots.map((d) => {
    const tie = seen.get(d.value) ?? 0;
    seen.set(d.value, tie + 1);
    const nudge = tie * 24 * (pct(d.value) > 60 ? -1 : 1);
    return { ...d, left: pct(d.value), nudge };
  });

  return (
    <div>
      <p className="mb-4 text-[15.5px] text-ink-body">{overlap.label}</p>
      <div className="relative">
        <div className="relative h-8.5 overflow-hidden rounded-lg border border-border-soft bg-card">
          <div
            className="absolute top-0 bottom-0 left-0 border-r-2 border-positive bg-positive/15"
            style={{ width: `${floorPct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 bg-accent/20"
            style={{ left: `${floorPct}%`, width: `${Math.max(0, comfyPct - floorPct)}%` }}
          />
        </div>
        {positioned.map((d, i) => (
          <div
            key={i}
            className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 border-card text-[9.5px] text-cream shadow"
            style={{
              left: `calc(${d.left}% + ${d.nudge}px)`,
              transform: "translate(-50%, -50%)",
              background: DOT_COLORS[i % DOT_COLORS.length],
            }}
          >
            {d.name ? d.name.slice(0, 2).toUpperCase() : ""}
          </div>
        ))}
      </div>
      <div className="mt-5 flex gap-5 text-[13.5px]">
        <div className="flex items-center gap-1.5 text-body">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-positive" />${overlap.floor} works for all{" "}
          {overlap.dots.length}
        </div>
        <div className="flex items-center gap-1.5 text-muted">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-accent/40" />${overlap.comfy} works for most
        </div>
      </div>
    </div>
  );
}

export default async function ConvergencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tripId } = await params;
  const user = await getPlannerUser();
  if (!user) redirect(`/planner/login`);

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) notFound();

  const { data: trip } = await admin
    .from("planner_trips")
    .select("name, privacy")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) notFound();

  const { data: myPref } = await admin
    .from("planner_preferences")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!myPref) redirect(`/planner/trips/${tripId}/preferences`);

  const { count: total } = await admin
    .from("planner_memberships")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId);

  const { data: prefRows } = await admin
    .from("planner_preferences")
    .select("*, planner_users(id, name, email)")
    .eq("trip_id", tripId);

  const rows = prefRows ?? [];
  const isPrivate = trip.privacy === "private";

  const overlaps = BUDGET_FIELDS.map((field) => {
    const entries = rows
      .filter((r) => typeof r[field.key] === "number")
      .map((r) => {
        const person = r.planner_users as unknown as { id: string; name: string | null; email: string | null } | null;
        return {
          value: r[field.key] as number,
          userId: isPrivate ? null : (person?.id ?? null),
          name: isPrivate ? null : person?.name || person?.email?.split("@")[0] || null,
        };
      });
    return computeOverlap(field.key, field.label, field.max, entries);
  }).filter((o): o is NonNullable<typeof o> => o !== null);

  const clusters = computeClusters(
    rows.map((r) => (r.interests as string[]) ?? []),
    rows.length
  );

  const nonNegotiables = rows
    .map((r) => r.non_negotiable as string | null)
    .filter((n): n is string => Boolean(n));

  let reads: Awaited<ReturnType<typeof generateConvergenceReads>> = [];
  if (overlaps.length > 0) {
    try {
      reads = await generateConvergenceReads(trip.name, overlaps, clusters, nonNegotiables);
    } catch {
      reads = [];
    }
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-9 py-5.5">
        <span className="text-[21px] font-display text-ink">&ldquo;that friend&rdquo;</span>
        <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
          {rows.length} of {total ?? 0} answered
        </p>
      </header>

      <div className="mx-auto max-w-[900px] px-6 py-14 pb-30">
        <p className="mb-3.5 font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">
          {trip.name}
        </p>
        <h1 className="mb-3.5 text-[46px] leading-[1.06] font-display tracking-tight text-ink">
          {rows.length >= (total ?? 0) && rows.length > 0 ? "Here’s what everyone landed on." : "Here’s where we landed so far."}
        </h1>
        <p className="mb-12 max-w-xl text-lg leading-relaxed text-body">
          {isPrivate
            ? "Nobody saw anyone else’s numbers while they answered. This is the overlap, which is the only part that matters."
            : "Everyone could see each other’s numbers as they answered. This is the overlap, which is the only part that matters."}
        </p>

        {overlaps.length > 0 ? (
          <>
            <p className="mb-5 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
              What everyone can spend
            </p>
            <div className="mb-5 flex flex-col gap-7.5">
              {overlaps.map((o) => (
                <OverlapBar key={o.key} overlap={o} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Nobody&rsquo;s answered yet.</p>
        )}

        <div className="my-11 border-t border-border" />

        <div className="grid grid-cols-1 items-start gap-11 lg:grid-cols-[minmax(240px,1fr)_minmax(280px,1.15fr)]">
          <div>
            <p className="mb-5 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
              What people want
            </p>
            <div className="flex flex-col gap-4">
              {clusters.length === 0 && (
                <p className="text-sm text-muted">No interests picked yet.</p>
              )}
              {clusters.map((c) => (
                <div key={c.label}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[14.5px] text-ink-body">{c.label}</span>
                    <span className="font-mono text-[11.5px] text-muted">
                      {c.count} of {c.total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-border-soft">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${(c.count / Math.max(1, c.total)) * 100}%`,
                        background:
                          c.count / c.total >= 0.66
                            ? "var(--color-positive)"
                            : c.count / c.total >= 0.5
                              ? "var(--color-caution)"
                              : "var(--color-ink-ghost)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-5 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
              So here&rsquo;s the shape of it
            </p>
            <div className="flex flex-col gap-5">
              {reads.length === 0 && (
                <p className="text-sm text-muted">
                  Reads will show up once a few more people answer.
                </p>
              )}
              {reads.map((r, i) => (
                <div key={i}>
                  <p className="mb-1.5 text-xl leading-tight font-display text-ink">{r.head}</p>
                  <p className="text-[14.5px] leading-relaxed text-body">{r.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-11 flex flex-wrap items-center gap-4">
          <Link
            href={`/planner/trips/${tripId}`}
            className="rounded-full bg-ink px-7.5 py-3.5 text-[15.5px] text-cream hover:bg-accent"
          >
            Open the workspace
          </Link>
          <Link
            href={`/planner/trips/${tripId}/preferences`}
            className="text-sm text-body underline hover:text-accent"
          >
            Change my answers
          </Link>
        </div>
      </div>
    </div>
  );
}
