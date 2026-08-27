import { notFound, redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";

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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 bg-cream px-4 py-12">
      <div className="rounded-2xl border border-dashed border-border p-3 text-center text-xs text-muted">
        Placeholder page — this stands in for the &quot;Workspace&quot; screen (days,
        itinerary, decisions, map) until later phases.
      </div>

      <div>
        <h1 className="font-display text-3xl text-ink">{trip.name}</h1>
        {trip.destination && <p className="text-muted">{trip.destination}</p>}
        <p className="text-xs text-muted">Privacy: {trip.privacy}</p>
      </div>

      {membership.role === "owner" && joinInvite && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-ink/80">Invite link</p>
          <p className="mt-1 break-all font-mono text-xs text-accent">
            {siteUrl}/planner/join/{joinInvite.token}
          </p>
        </div>
      )}

      <div>
        <h2 className="font-display text-xl text-ink">Members</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {(members ?? []).map((m, i) => {
            const person = m.planner_users as unknown as {
              name: string | null;
              email: string | null;
              phone: string | null;
            } | null;
            return (
              <li
                key={i}
                className="rounded-xl border border-border bg-card px-4 py-2 text-sm"
              >
                <span className="text-ink">
                  {person?.name || person?.email || person?.phone || "Someone"}
                </span>{" "}
                <span className="text-muted">— {m.role}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
