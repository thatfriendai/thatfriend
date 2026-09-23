import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDayLabel } from "@/lib/planner/itinerary";
import { formatDateRange } from "@/lib/planner/calendarDate";
import { withoutEmptyStaleDays } from "@/lib/planner/days";
import { Stars } from "@/components/planner/Stars";

/**
 * Anyone with the link can read this page, so a rater with no name set
 * stays anonymous — falling back to their email's local part (as the
 * signed-in views do) would publish a piece of their address.
 */
function labelOf(person: { name: string | null } | null) {
  return person?.name || "A friend";
}

export default async function SharedItineraryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: trip } = await admin
    .from("planner_trips")
    .select("id, name, destination, start_date, end_date")
    .eq("share_token", token)
    .maybeSingle();
  if (!trip) notFound();

  const { data: allDays } = await admin
    .from("planner_days")
    .select("id, date, city, color")
    .eq("trip_id", trip.id)
    .order("date", { ascending: true });

  // Days left over from an earlier date range stay in the table (see
  // ensureDays) — shared the same way the trip page shows them.
  const days =
    trip.start_date && trip.end_date
      ? await withoutEmptyStaleDays(admin, allDays ?? [], trip.start_date, trip.end_date)
      : (allDays ?? []);

  const dayIds = days.map((d) => d.id);
  const { data: items } = dayIds.length
    ? await admin
        .from("planner_itinerary_items")
        .select("id, day_id, text, position")
        .in("day_id", dayIds)
        .order("position", { ascending: true })
    : { data: [] };

  const itemIds = (items ?? []).map((i) => i.id);
  const { data: ratingRows } = itemIds.length
    ? await admin
        .from("planner_item_ratings")
        .select("item_id, stars, note, planner_users(name)")
        .in("item_id", itemIds)
    : { data: [] };

  const ratingsByItem = new Map<string, { stars: number; note: string | null; who: string }[]>();
  for (const r of ratingRows ?? []) {
    const who = labelOf(r.planner_users as unknown as { name: string | null } | null);
    if (!ratingsByItem.has(r.item_id)) ratingsByItem.set(r.item_id, []);
    ratingsByItem.get(r.item_id)!.push({ stars: r.stars, note: r.note, who });
  }

  const daysWithItems = days.map((d) => ({
    ...d,
    items: (items ?? []).filter((i) => i.day_id === d.id),
  }));

  const dateRange =
    trip.start_date && trip.end_date
      ? formatDateRange(trip.start_date, trip.end_date)
      : null;

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border bg-card px-7 py-4">
        <span className="text-xl font-display text-ink">&ldquo;that friend&rdquo;</span>
      </header>
      <div className="mx-auto max-w-[820px] px-6 py-14 pb-28">
        <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
          {trip.destination ?? ""}
          {dateRange ? ` · ${dateRange}` : ""}
        </p>
        <h1 className="mb-8 text-4xl leading-[1.08] font-display tracking-tight text-ink">
          {trip.name}
        </h1>

        {daysWithItems.filter((d) => d.items.length > 0).length === 0 ? (
          <p className="text-[15px] text-muted">Nothing shared yet.</p>
        ) : (
          <div className="flex flex-col gap-7">
            {daysWithItems
              .filter((d) => d.items.length > 0)
              .map((d) => (
                <div key={d.id}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: d.color }} />
                    <span className="font-mono text-[10.5px] tracking-[0.1em] text-[#6B655C]">
                      {formatDayLabel(d.date)}
                      {d.city ? ` · ${d.city.toUpperCase()}` : ""}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {d.items.map((item) => {
                      const itemRatings = ratingsByItem.get(item.id) ?? [];
                      return (
                        <div key={item.id} className="rounded-xl border border-border-soft bg-card px-4 py-3">
                          <p className="mb-1.5 text-[14.5px] text-ink">{item.text}</p>
                          {itemRatings.length > 0 && (
                            <div className="flex flex-col gap-1">
                              {itemRatings.map((r, i) => (
                                <div key={i} className="flex items-baseline gap-2 text-[13px]">
                                  <Stars value={r.stars} />
                                  <span className="text-muted">{r.who}</span>
                                  {r.note && <span className="text-body">&middot; {r.note}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
