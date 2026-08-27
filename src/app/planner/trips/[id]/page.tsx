import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { CopyInviteLink } from "./CopyInviteLink";

const AVATAR_COLORS = ["#C9A227", "#6E8C6A", "#8A5A7A", "#4A453E", "#3F6E7A", "#B4664A"];

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function PlannerTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getPlannerUser();
  if (!user) redirect("/planner/login");

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("role")
    .eq("trip_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) notFound();

  const { data: trip } = await admin
    .from("planner_trips")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const { data: members } = await admin
    .from("planner_memberships")
    .select("role, planner_users(name, email, phone)")
    .eq("trip_id", id);

  const { data: joinInvite } = await admin
    .from("planner_invites")
    .select("token")
    .eq("trip_id", id)
    .eq("channel", "link")
    .limit(1)
    .maybeSingle();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const roster = (members ?? []).map((m) => {
    const person = m.planner_users as unknown as {
      name: string | null;
      email: string | null;
      phone: string | null;
    } | null;
    const label = person?.name || person?.email?.split("@")[0] || person?.phone || "Someone";
    return { label, role: m.role };
  });

  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase()}–${new Date(trip.end_date).toLocaleDateString(undefined, { day: "numeric" }).toUpperCase()}`
      : null;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-card px-7 py-3.5">
        <div className="flex items-center gap-5">
          <Link href="/planner/trips" className="text-xl font-display text-ink">
            &ldquo;that friend&rdquo;
          </Link>
          <div className="h-5 w-px bg-border" />
          <div>
            <p className="text-[15px] font-medium text-ink">{trip.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted">
              {dateRange ?? "Dates not set"} &middot; {roster.length}{" "}
              {roster.length === 1 ? "traveller" : "travellers"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          <div className="flex">
            {roster.slice(0, 5).map((m, i) => (
              <div
                key={i}
                className="ml-[-5px] flex h-6.5 w-6.5 items-center justify-center rounded-full border-2 border-card text-[11px] text-cream"
                style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                title={m.label}
              >
                {initialsOf(m.label)}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1080px] px-6 py-9.5 pb-28">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <h1 className="text-[38px] leading-[1.08] font-display tracking-tight text-ink">
              {trip.name}
            </h1>
            {trip.destination && (
              <p className="mt-1.5 text-sm text-muted">{trip.destination}</p>
            )}
          </div>
          <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
            {trip.privacy === "private" ? "Private trip" : "Open trip"}
          </p>
        </div>

        {membership.role === "owner" && joinInvite && (
          <div className="mb-12">
            <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
              <span className="font-mono text-[11px] text-[#C0B8A8]">01</span>
              <span className="text-[25px] font-display text-ink">Invite the group</span>
            </div>
            <CopyInviteLink url={`${siteUrl}/planner/join/${joinInvite.token}`} />
          </div>
        )}

        <div className="mb-12">
          <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
            <span className="font-mono text-[11px] text-[#C0B8A8]">02</span>
            <span className="text-[25px] font-display text-ink">Who&rsquo;s in</span>
          </div>
          <div className="flex flex-col gap-2">
            {roster.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] text-cream"
                  style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                >
                  {initialsOf(m.label)}
                </div>
                <span className="text-[15px] text-ink-soft">{m.label}</span>
                <span className="ml-auto font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-input-border p-7 text-center">
          <p className="mb-1.5 text-xl font-display text-ink">
            The plan, decisions, and map land here next
          </p>
          <p className="text-[15px] text-body">
            Preferences, the convergence view, itinerary, and decisions are
            the next phases of the build.
          </p>
        </div>
      </div>
    </div>
  );
}
