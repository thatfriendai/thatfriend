import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlannerUser } from "@/lib/planner/session";
import { inviteIsForPhone, resolveInviteToken } from "@/lib/planner/joinLink";
import { loadJoinPreview } from "@/lib/planner/joinPreview";
import { JoinTripPreview } from "@/components/planner/JoinTripPreview";
import { JoinTripButton } from "@/components/planner/JoinTripButton";

/**
 * Step 2 of the invite flow, from the trip-wide share link the organizer
 * put on the share sheet: the trip preview, one line saying texts are part
 * of it, one button. Tapping is joining and consenting in one action.
 */
// /j/<token> and /j/istanbul/<token> both land here — the slug is only
// there so the link reads well in a text; the last segment is the token.
function tokenFrom(params: { parts: string[] }): string {
  return params.parts[params.parts.length - 1] ?? "";
}

/** The link preview in iMessage/WhatsApp — "Idil invites you to Istanbul" — so the bare URL isn't all a friend sees. */
export async function generateMetadata({ params }: { params: Promise<{ parts: string[] }> }): Promise<Metadata> {
  const token = tokenFrom(await params);
  const admin = createAdminClient();
  const invite = await resolveInviteToken(admin, token);
  const preview = invite ? await loadJoinPreview(admin, invite.tripId) : null;
  if (!preview) return { title: "That Friend" };
  const title = `${preview.ownerName} invites you to ${preview.tripName}`;
  const description = [preview.dateRange, "Tap to join on That Friend"].filter(Boolean).join(" · ");
  const images = [{ url: `/api/og/invite/${encodeURIComponent(token)}`, width: 1200, height: 630, alt: title }];
  return { title, description, openGraph: { title, description, siteName: "That Friend", images }, twitter: { card: "summary_large_image", images } };
}

export default async function JoinPage({ params }: { params: Promise<{ parts: string[] }> }) {
  const token = tokenFrom(await params);
  const admin = createAdminClient();

  const invite = await resolveInviteToken(admin, token);
  if (!invite) notFound();

  const [preview, user] = await Promise.all([loadJoinPreview(admin, invite.tripId), getPlannerUser()]);
  if (!preview) notFound();

  // A per-phone invite token only admits the number it was texted to (see
  // acceptInviteToken). Signed out, /j/<token> is the page built for that —
  // it texts the code straight to the invited number. Signed in as someone
  // else, say so up front instead of offering a button that can't work.
  if (invite.source === "phone" && !user) redirect(`/j/${encodeURIComponent(token)}`);
  const wrongPhone = invite.source === "phone" && Boolean(user) && !inviteIsForPhone(invite.phone, user?.phone ?? null);

  let alreadyMember = false;
  if (user) {
    const { data: membership } = await admin
      .from("planner_memberships")
      .select("trip_id")
      .eq("trip_id", invite.tripId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    alreadyMember = Boolean(membership);
  }

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
      ) : wrongPhone ? (
        <p className="text-[15px] text-body">
          This invite was texted to a different number than the one on your account. Ask whoever invited you for
          the trip&rsquo;s share link.
        </p>
      ) : (
        <JoinTripButton token={token} tripName={preview.tripName} signedIn={Boolean(user)} />
      )}
    </JoinTripPreview>
  );
}
