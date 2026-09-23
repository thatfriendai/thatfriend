import Link from "next/link";
import { AuthPanel } from "./AuthPanel";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveInviteToken } from "@/lib/planner/joinLink";
import { safeNextPath } from "@/lib/planner/session";
import { TripPreviewCard } from "@/components/TripPreviewCard";

export default async function PlannerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; next?: string }>;
}) {
  const { token, error, next: rawNext } = await searchParams;
  // Where to go after signing in — e.g. the trip page that bounced them
  // here. Validated here and again server-side wherever it's acted on.
  const next = safeNextPath(rawNext) ?? undefined;

  // Arriving from "Join <trip>" — keep the trip in view and lead with the
  // phone, since the tap they just made was about getting trip texts.
  let joiningTripName: string | null = null;
  if (token) {
    const admin = createAdminClient();
    const invite = await resolveInviteToken(admin, token);
    if (invite) {
      const { data: trip } = await admin.from("planner_trips").select("name").eq("id", invite.tripId).maybeSingle();
      joiningTripName = trip?.name ?? null;
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-16 sm:py-10">
        <span className="text-xl font-display text-ink">&ldquo;that friend&rdquo;</span>
        <div className="my-auto w-full max-w-[400px] py-10">
          <h1 className="mb-3 text-[40px] leading-[1.06] font-display tracking-tight text-ink sm:text-5xl">
            {joiningTripName ? `Join ${joiningTripName}.` : "Sign in or sign up."}
          </h1>
          <p className="mb-8 text-base leading-relaxed text-body">
            {joiningTripName
              ? "Put in your number and we'll text you a code — that's the whole sign-up. No password, no app to download."
              : "One box for both. Put in your email or your number and we'll take you to the right place. No password to forget, no app to download."}
          </p>
          {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
          <AuthPanel token={token} next={next} defaultMode={joiningTripName ? "phone" : "email"} />
          {!joiningTripName && (
            <p className="mt-6 text-[13px] text-faint">
              Invited by a friend? Use the same email they sent the link to.
            </p>
          )}
          <p className="mt-4 text-[12.5px] leading-relaxed text-faint">
            By entering your phone number, you agree to receive automated
            text messages from That Friend — sign-in codes, confirmations
            when something you forward gets added to a trip, and trip
            reminders. Message frequency varies. Message and data rates may
            apply. Reply STOP to opt out, HELP for help. See our{" "}
            <Link href="/privacy" className="underline hover:text-accent">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="underline hover:text-accent">
              Terms &amp; Conditions
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="hidden flex-col justify-center gap-7 bg-dark px-10 py-14 lg:flex">
        <TripPreviewCard dark />
        <p className="max-w-[22em] text-2xl leading-snug font-display text-[#E8E2D6]">
          &ldquo;Six of us, four cities, one doc. It took a week instead of a
          year.&rdquo;
        </p>
      </div>
    </div>
  );
}
