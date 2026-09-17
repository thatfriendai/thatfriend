import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateJoinCode } from "@/lib/planner/tokens";
import { formatPhoneDisplay } from "@/lib/planner/phone";
import { JoinLinkButton } from "./JoinLinkButton";

export default async function TripInviteLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("planner_trip_invites")
    .select("id, trip_id, clicked_at")
    .eq("token", token)
    .maybeSingle();
  if (!invite) notFound();

  const { data: trip } = await admin
    .from("planner_trips")
    .select("name, destination, join_code, created_by")
    .eq("id", invite.trip_id)
    .maybeSingle();
  if (!trip) notFound();

  // Every invite going through this page needs a join code to text back —
  // backfill it the same way the web "Generate a join code" button does,
  // for trips old enough to predate this feature.
  let joinCode = trip.join_code;
  if (!joinCode) {
    joinCode = generateJoinCode(trip.destination ?? trip.name);
    await admin.from("planner_trips").update({ join_code: joinCode }).eq("id", invite.trip_id);
  }

  // Funnel signal, not a reliable one — link-preview fetchers (iMessage,
  // some Android messaging apps) can prefetch this page before a human
  // ever taps it, so clicked_at can fire early. joined_at is the signal
  // that actually means something.
  if (!invite.clicked_at) {
    await admin
      .from("planner_trip_invites")
      .update({ clicked_at: new Date().toISOString() })
      .eq("id", invite.id);
  }

  const { data: owner } = await admin
    .from("planner_users")
    .select("name, email")
    .eq("id", trip.created_by)
    .maybeSingle();
  const ownerName = owner?.name || owner?.email?.split("@")[0] || "Someone";

  const smsNumber = process.env.TWILIO_SMS_NUMBER ?? null;
  const smsNumberDisplay = smsNumber ? formatPhoneDisplay(smsNumber) : null;
  const ua = (await headers()).get("user-agent") ?? "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

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
        {trip.destination && <p className="mb-8 text-[16.5px] text-body">{trip.destination}</p>}

        {smsNumber && smsNumberDisplay ? (
          <JoinLinkButton smsNumber={smsNumber} smsNumberDisplay={smsNumberDisplay} joinCode={joinCode} isIOS={isIOS} />
        ) : (
          <p className="text-[15px] text-body">Sign in to the app to join this trip.</p>
        )}

        <p className="mt-8 text-sm text-muted">
          Already texted us before?{" "}
          <Link href="/planner/login" className="text-ink underline">
            Sign in
          </Link>{" "}
          instead.
        </p>
      </div>
    </div>
  );
}
