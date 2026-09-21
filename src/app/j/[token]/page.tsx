import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { resolveInviteToken } from "@/lib/planner/joinLink";
import { loadJoinPreview } from "@/lib/planner/joinPreview";
import { normalizePhoneDigits } from "@/lib/planner/phone";
import { JoinTripPreview } from "@/components/planner/JoinTripPreview";
import { JoinTripButton } from "@/components/planner/JoinTripButton";
import { JoinWithCode } from "./JoinWithCode";

/**
 * Step 2 of the invite flow, from the per-phone invite text. Same page as
 * the share link's (src/app/planner/join/[token]) — the difference is that
 * the number is already known, so the tap sends the sign-in code to it
 * right here instead of asking for the number first. Replying "1" to the
 * text is the other, even shorter way in.
 */
export default async function TripInviteLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const invite = await resolveInviteToken(admin, token);
  if (!invite || invite.source !== "phone") notFound();

  // Funnel signal, not a reliable one — link-preview fetchers (iMessage,
  // some Android messaging apps) can prefetch this page before a human
  // ever taps it, so clicked_at can fire early. joined_at is the signal
  // that actually means something.
  if (!invite.clickedAt) {
    await admin.from("planner_trip_invites").update({ clicked_at: new Date().toISOString() }).eq("id", invite.inviteId);
  }

  const [preview, user] = await Promise.all([loadJoinPreview(admin, invite.tripId), getPlannerUser()]);
  if (!preview) notFound();

  let alreadyMember = false;
  if (user) {
    const { data: membership } = await admin
      .from("planner_memberships")
      .select("trip_id")
      .eq("trip_id", invite.tripId)
      .eq("user_id", user.id)
      .maybeSingle();
    alreadyMember = Boolean(membership);
  }

  const digits = normalizePhoneDigits(invite.phone);
  const phoneMasked = `(•••) •••-${digits.slice(-4)}`;

  return (
    <JoinTripPreview
      ownerName={preview.ownerName}
      tripName={preview.tripName}
      destination={preview.destination}
      dateRange={preview.dateRange}
      memberNames={preview.memberNames}
      signedIn={Boolean(user)}
    >
      {alreadyMember ? (
        <div className="flex flex-col gap-3">
          <p className="text-[15px] text-body">You&rsquo;re already in.</p>
          <Link
            href={`/planner/trips/${invite.tripId}`}
            className="flex items-center justify-center rounded-full bg-ink px-7 py-4 text-[16px] text-cream hover:bg-accent"
          >
            Open {preview.tripName}
          </Link>
        </div>
      ) : user ? (
        <JoinTripButton token={token} tripName={preview.tripName} signedIn />
      ) : (
        <JoinWithCode token={token} phoneMasked={phoneMasked} tripName={preview.tripName} />
      )}
    </JoinTripPreview>
  );
}
