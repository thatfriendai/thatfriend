import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import type { Trip } from "@/lib/supabase/types";

export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Trip[]>();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 bg-cream px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-ink">Your trips</h1>
        <form action={signOut}>
          <button className="text-sm text-muted hover:text-ink">
            Log out
          </button>
        </form>
      </div>

      <Link
        href="/trips/new"
        className="w-fit rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink"
      >
        + Create a trip
      </Link>

      {!trips || trips.length === 0 ? (
        <p className="text-sm text-muted">No trips yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/trip/${trip.id}`}
                className="block rounded-2xl border border-border bg-card px-5 py-4 hover:border-accent"
              >
                <p className="font-display text-lg text-ink">{trip.name}</p>
                {trip.target_dates && (
                  <p className="text-sm text-muted">{trip.target_dates}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
