import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function PlannerTripsPage() {
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("planner_memberships")
    .select("role, planner_trips(id, name, destination, start_date, end_date)")
    .eq("user_id", user.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 bg-cream px-4 py-12">
      <div className="rounded-2xl border border-dashed border-border p-3 text-center text-xs text-muted">
        Placeholder page — not yet styled to the &quot;Trips&quot; screen design.
      </div>
      <h1 className="font-display text-3xl text-ink">Your trips</h1>
      <Link
        href="/planner/trips/new"
        className="w-fit rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink"
      >
        + Create a trip
      </Link>

      {!memberships || memberships.length === 0 ? (
        <p className="text-sm text-muted">No trips yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {memberships.map((m) => {
            const trip = m.planner_trips as unknown as {
              id: string;
              name: string;
              destination: string | null;
            } | null;
            if (!trip) return null;
            return (
              <li key={trip.id}>
                <Link
                  href={`/planner/trips/${trip.id}`}
                  className="block rounded-2xl border border-border bg-card px-5 py-4 hover:border-accent"
                >
                  <p className="font-display text-lg text-ink">{trip.name}</p>
                  {trip.destination && (
                    <p className="text-sm text-muted">{trip.destination}</p>
                  )}
                  <p className="text-xs text-muted">{m.role}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
