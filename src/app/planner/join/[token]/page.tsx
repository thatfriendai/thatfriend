import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthPanel } from "@/app/planner/login/AuthPanel";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("planner_invites")
    .select("trip_id")
    .eq("token", token)
    .maybeSingle();

  if (!invite) notFound();

  const { data: trip } = await admin
    .from("planner_trips")
    .select("name, destination, start_date, end_date, created_by")
    .eq("id", invite.trip_id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: owner } = await admin
    .from("planner_users")
    .select("name, email")
    .eq("id", trip.created_by)
    .maybeSingle();

  const { data: members } = await admin
    .from("planner_memberships")
    .select("planner_users(name, email)")
    .eq("trip_id", invite.trip_id);

  const ownerName = owner?.name || owner?.email?.split("@")[0] || "Someone";
  const memberNames = (members ?? [])
    .map((m) => {
      const u = m.planner_users as unknown as { name: string | null; email: string | null } | null;
      return u?.name || u?.email?.split("@")[0];
    })
    .filter((n): n is string => Boolean(n));

  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date).toLocaleDateString(undefined, { month: "long", day: "numeric" })} – ${new Date(trip.end_date).toLocaleDateString(undefined, { day: "numeric" })}`
      : trip.start_date
        ? new Date(trip.start_date).toLocaleDateString(undefined, { month: "long", day: "numeric" })
        : null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-8 py-6 sm:px-14">
        <span className="text-xl font-display text-ink">&ldquo;that friend&rdquo;</span>
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link href="/planner/login" className="text-ink underline">
            Sign in
          </Link>
        </p>
      </header>

      <div className="mx-auto my-auto w-full max-w-[620px] px-6 py-10 pb-20">
        <p className="mb-5 font-mono text-[11.5px] tracking-[0.14em] text-muted uppercase">
          {ownerName} invited you
        </p>
        <h1 className="mb-4 text-5xl leading-[1.04] font-display tracking-tight text-ink">
          {trip.name}
        </h1>
        <div className="mb-8 flex flex-wrap items-center gap-4.5">
          {dateRange && <p className="text-[16.5px] text-body">{dateRange}</p>}
          {memberNames.length > 0 && (
            <>
              {dateRange && <span className="h-1 w-1 rounded-full bg-input-border" />}
              <p className="text-[15px] text-body">
                {memberNames.slice(0, 4).join(", ")}
                {memberNames.length > 0 ? " are in" : ""}
              </p>
            </>
          )}
        </div>

        <div className="mb-7 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border-soft p-5.5">
            <p className="mb-2.5 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
              Where it stands
            </p>
            <p className="text-[15.5px] leading-relaxed text-ink-soft">
              {memberNames.length > 0
                ? `${memberNames.length} of the group ${memberNames.length === 1 ? "has" : "have"} joined so far. Nothing is booked yet, so you're not late.`
                : "Nobody's answered yet — you could be the first."}
            </p>
          </div>
          <div className="relative p-5.5 pb-6.5">
            <div className="flex flex-col gap-2.5 opacity-55 blur-[4px] select-none">
              <div className="h-2 w-[88%] rounded bg-border-soft" />
              <div className="h-2 w-[72%] rounded bg-border-soft" />
              <div className="h-2 w-[80%] rounded bg-border-soft" />
              <div className="h-2 w-[55%] rounded bg-border-soft" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted">
                Sign in to see the plan, notes and map
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 max-w-sm">
          <AuthPanel token={token} />
        </div>
        <p className="max-w-[46em] text-[13.5px] leading-relaxed text-muted">
          {ownerName} set the destination and dates already. All that&rsquo;s
          left for you is your side of it: what you can spend, and how you
          want the week to feel.
        </p>
      </div>
    </div>
  );
}
