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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your trips</h1>
        <form action={signOut}>
          <button className="text-sm text-zinc-500 underline">Log out</button>
        </form>
      </div>

      <Link
        href="/trips/new"
        className="w-fit rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        + Create a trip
      </Link>

      {!trips || trips.length === 0 ? (
        <p className="text-sm text-zinc-500">No trips yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/trip/${trip.id}`}
                className="block rounded border border-zinc-200 px-4 py-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <p className="font-medium">{trip.name}</p>
                {trip.target_dates && (
                  <p className="text-sm text-zinc-500">{trip.target_dates}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
