import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { LoginForm } from "@/app/planner/login/LoginForm";

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
    .select("name, destination")
    .eq("id", invite.trip_id)
    .maybeSingle();

  if (!trip) notFound();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-cream px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-dashed border-border p-3 text-center text-xs text-muted">
        Placeholder page — not yet styled to the &quot;New trip&quot;/invite-landing
        screen design.
      </div>
      <div className="text-center">
        <p className="text-sm text-muted">You&rsquo;re invited to</p>
        <h1 className="font-display text-3xl text-ink">{trip.name}</h1>
        {trip.destination && <p className="text-muted">{trip.destination}</p>}
      </div>
      <div className="w-full max-w-sm">
        <LoginForm token={token} />
      </div>
    </div>
  );
}
