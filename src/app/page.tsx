import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/trips");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-semibold">That Friend</h1>
      <p className="max-w-md text-zinc-500">
        Plan a group trip without the group chat chaos. Create a trip, share
        the link, and let everyone drop in their dates, budget, and places.
      </p>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
