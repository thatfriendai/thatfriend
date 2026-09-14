import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/planner/actions";
import { CopyInviteLink } from "./CopyInviteLink";
import { CopyJoinCode } from "./CopyJoinCode";
import { ItineraryBoard } from "./ItineraryBoard";
import { PlacesBoard } from "./PlacesBoard";
import { DecisionsSection } from "./decisions/DecisionsSection";
import { StaysSection } from "./StaysSection";
import { buildStayComparison } from "@/lib/planner/stayComparison";
import { generateStayRead } from "@/lib/planner/stayNarrative";
import { NudgeButton } from "./NudgeButton";
import { StartGroupText } from "./StartGroupText";
import { PreferencesSkipControl } from "./PreferencesSkipControl";
import { JoinRequests } from "./JoinRequests";
import { SourcesSection } from "./SourcesSection";
import { PreferencesModal } from "./PreferencesModal";
import { DatesModal } from "./DatesModal";
import { ConvergenceModal } from "./ConvergenceModal";
import { WorkspaceTopBar } from "./WorkspaceTopBar";
import { TripVisibilityToggle } from "./TripVisibilityToggle";
import { TripNameField } from "./TripNameField";
import { ensureDays } from "@/lib/planner/days";
import { DAY_COLORS } from "@/lib/planner/itinerary";
import { formatPhoneDisplay } from "@/lib/planner/phone";
import { computeAttention } from "@/lib/planner/attention";
import type { PlannerItineraryItem, ResourceType } from "@/lib/supabase/planner-types";

const AVATAR_COLORS = DAY_COLORS;

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

  // Every query here reads by trip_id/user_id alone — none depends on
  // another's result — so they run as one round-trip instead of nine
  // sequential ones, which was the single biggest contributor to how slow
  // this page felt to load.
  const [
    { data: membership },
    { data: trip },
    { data: members },
    { data: joinInvite },
    { data: myPref },
    { data: myAvailability },
    { data: resourceRows },
    { data: placeRows },
    { data: decisionRows },
    attention,
  ] = await Promise.all([
    admin.from("planner_memberships").select("role").eq("trip_id", id).eq("user_id", user.id).maybeSingle(),
    admin.from("planner_trips").select("*").eq("id", id).maybeSingle(),
    admin.from("planner_memberships").select("role, planner_users(name, email, phone)").eq("trip_id", id),
    admin.from("planner_invites").select("token").eq("trip_id", id).eq("channel", "link").limit(1).maybeSingle(),
    admin.from("planner_preferences").select("*").eq("trip_id", id).eq("user_id", user.id).maybeSingle(),
    admin.from("planner_availability_marks").select("date").eq("trip_id", id).eq("user_id", user.id),
    admin.from("planner_resources").select("*, planner_users(name, email)").eq("trip_id", id).order("created_at", { ascending: true }),
    admin.from("planner_places").select("*, planner_users(name, email)").eq("trip_id", id).order("created_at", { ascending: true }),
    admin
      .from("planner_decisions")
      // Explicit FK name: planner_decisions has two relationships to
      // planner_decision_options (the options belonging to it, and
      // decided_option_id pointing back at one of them) — PostgREST can't
      // pick one on its own once decided_option_id is set, and silently
      // fails the whole query instead of erroring loudly.
      .select(
        "*, planner_decision_options!planner_decision_options_decision_id_fkey(id, label), planner_decision_votes(option_id, user_id), planner_decision_notes(id)"
      )
      .eq("trip_id", id)
      .order("created_at", { ascending: false }),
    computeAttention(admin, id, user.id),
  ]);
  if (!membership) notFound();
  if (!trip) notFound();

  // These two depend on trip/days resolving above, so they stay sequential.
  const days = await ensureDays(admin, trip);
  const dayIds = days.map((d) => d.id);

  const { data: items } = dayIds.length
    ? await admin
        .from("planner_itinerary_items")
        .select("*")
        .in("day_id", dayIds)
        .order("position", { ascending: true })
    : { data: [] as PlannerItineraryItem[] };

  const daysWithItems = days.map((d) => ({
    ...d,
    items: (items ?? []).filter((i) => i.day_id === d.id),
  }));

  const places = (placeRows ?? []).map((p) => {
    const person = p.planner_users as unknown as {
      name: string | null;
      email: string | null;
    } | null;
    const who = person?.name || person?.email?.split("@")[0] || "Someone";
    return { ...p, who };
  });

  // A resource whose forward turned into a place already lives there — its
  // own card, with its own "added by X" line — so listing it again here
  // would just be the same information twice. What's left, and all this
  // section shows now, is resources with no place attached at all: a link
  // or note someone added on purpose to keep around, not to extract from.
  // Identical adds (the same link, more than once) collapse into one row
  // with a "forwarded N×" count instead of listing each one separately.
  const resourceGroups = new Map<
    string,
    { id: string; type: ResourceType; label: string; who: string; source_url: string | null; count: number; created_at: string }
  >();
  for (const r of resourceRows ?? []) {
    const hasPlace = places.some((p) => p.resource_id === r.id);
    if (hasPlace) continue;

    const person = r.planner_users as unknown as { name: string | null; email: string | null } | null;
    const who = person?.name || person?.email?.split("@")[0] || "Someone";
    const key = r.source_url ? `link:${r.source_url}` : `${r.type}:${r.label}`;
    const existing = resourceGroups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      resourceGroups.set(key, {
        id: r.id as string,
        type: r.type as ResourceType,
        label: r.label as string,
        who,
        source_url: r.source_url as string | null,
        count: 1,
        created_at: r.created_at as string,
      });
    }
  }
  const resources = [...resourceGroups.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const decisions = (decisionRows ?? []).map((d) => {
    const options = (d.planner_decision_options ?? []) as { id: string; label: string }[];
    const votes = (d.planner_decision_votes ?? []) as { option_id: string; user_id: string }[];
    const decidedOption = options.find((o) => o.id === d.decided_option_id);
    return {
      ...d,
      optionCount: options.length,
      voteCount: votes.length,
      noteCount: (d.planner_decision_notes ?? []).length,
      decidedLabel: decidedOption?.label ?? null,
    };
  });

  const stayCount = decisions.filter((d) => d.kind === "stay").length;
  const generalCount = decisions.filter((d) => d.kind === "general").length;
  // Scoped to the same "general" decisions the adjacent count already
  // shows — a stay decision needing a vote shouldn't light up a badge next
  // to a number that doesn't include it.
  const decisionsNeedVote = decisions.some(
    (d) =>
      d.kind === "general" &&
      d.status === "open" &&
      !d.planner_decision_votes?.some((v: { user_id: string }) => v.user_id === user.id)
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const smsNumber = process.env.TWILIO_SMS_NUMBER ?? null;
  const roster = (members ?? []).map((m) => {
    const person = m.planner_users as unknown as {
      name: string | null;
      email: string | null;
      phone: string | null;
    } | null;
    const label =
      person?.name || person?.email?.split("@")[0] || (person?.phone ? formatPhoneDisplay(person.phone) : null) || "Someone";
    return { label, role: m.role };
  });

  const stayDecisionRow = decisions.find((d) => d.kind === "stay") ?? null;
  let stayDecision: {
    id: string;
    title: string;
    status: "open" | "closed";
    deadline: string | null;
    decidedOptionLabel: string | null;
    comparison: Awaited<ReturnType<typeof buildStayComparison>> & { read: string | null };
  } | null = null;
  if (stayDecisionRow) {
    const comparison = await buildStayComparison(admin, id, stayDecisionRow.id, stayDecisionRow.nights, roster.length);
    const read = await generateStayRead(stayDecisionRow.title, comparison);
    stayDecision = {
      id: stayDecisionRow.id,
      title: stayDecisionRow.title,
      status: stayDecisionRow.status,
      deadline: stayDecisionRow.deadline,
      decidedOptionLabel: stayDecisionRow.decidedLabel,
      comparison: { ...comparison, read },
    };
  }

  let pendingJoinRequests: { id: string; label: string }[] = [];
  if (membership.role === "owner") {
    const { data: requestRows } = await admin
      .from("planner_join_requests")
      .select("id, planner_users(name, email)")
      .eq("trip_id", id)
      .eq("status", "pending");
    pendingJoinRequests = (requestRows ?? []).map((r) => {
      const person = r.planner_users as unknown as { name: string | null; email: string | null } | null;
      return { id: r.id, label: person?.name || person?.email?.split("@")[0] || "Someone" };
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase()}–${new Date(trip.end_date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric" }).toUpperCase()}`
      : null;

  const navLabel = user.name || user.email || "?";

  return (
    <div className="min-h-screen">
      <WorkspaceTopBar
        tripId={id}
        tripName={trip.name}
        dateRange={dateRange}
        travellerCount={roster.length}
        roster={roster}
        avatarColors={AVATAR_COLORS}
        navInitial={initialsOf(navLabel)}
        navUsername={user.username}
        signOutAction={signOut}
        navCounts={{
          places: places.length,
          stays: stayCount,
          sources: resources.length,
          decisions: generalCount,
          decisionsNeedVote,
        }}
      />

      <div className="mx-auto max-w-[1080px] px-6 py-9.5 pb-28">
        <div id="trip101" className="mb-12">
          <TripNameField
            tripId={id}
            initialName={trip.name}
            className="w-full min-w-0 rounded-lg border border-transparent bg-transparent p-0 text-[38px] leading-[1.08] font-display tracking-tight text-ink outline-none hover:border-input-border focus:border-ink"
          />
          {trip.destination && (
            <p className="mt-1.5 mb-4 text-sm text-muted">{trip.destination}</p>
          )}

          <div className="mb-8 flex flex-wrap items-center gap-2.5">
            <DatesModal tripId={id} dateRangeLabel={dateRange ?? "Not set"} />
            <TripVisibilityToggle tripId={id} initialIsPublic={trip.is_public} readOnly={membership.role !== "owner"} />
            <PreferencesModal
              tripId={id}
              tripName={trip.name}
              initial={myPref}
              isPrivate={trip.privacy === "private"}
              datesLocked={Boolean(trip.dates_locked_at)}
              initialAvailableDates={(myAvailability ?? []).map((d) => d.date as string)}
            />
            <ConvergenceModal tripId={id} tripName={trip.name} hasAnsweredPreferences={Boolean(myPref)} />
            {trip.end_date && trip.end_date < today && (
              <Link
                href={`/planner/trips/${id}/reviews`}
                className="rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[13px] text-ink hover:border-ink"
              >
                Reviews
              </Link>
            )}
          </div>

          {attention.items.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-warm-border bg-warm-bg">
              {attention.items.map((item, i) => (
                <div
                  key={item.kind}
                  className={`flex flex-wrap items-center justify-between gap-3.5 px-5.5 py-4 ${
                    i > 0 ? "border-t border-warm-border" : ""
                  }`}
                >
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[10px] tracking-[0.08em] text-faint uppercase">
                      {i === 0 ? "First" : "Then"}
                    </span>
                    <span className="text-[14.5px] text-ink-body">{item.label}</span>
                  </div>
                  <Link
                    href={item.href}
                    className={
                      i === 0
                        ? "flex-none rounded-full bg-accent px-4 py-2 text-[13.5px] text-on-accent hover:opacity-90"
                        : "flex-none rounded-full border border-input-border bg-card px-4 py-2 text-[13.5px] text-ink hover:border-ink"
                    }
                  >
                    {item.cta}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-12">
          <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
            <span className="font-mono text-[11px] text-faint">01</span>
            <span className="text-[25px] font-display text-ink">Who&rsquo;s in</span>
          </div>
          {membership.role === "owner" && (
            <JoinRequests tripId={id} initial={pendingJoinRequests} />
          )}
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
                <span className="text-[15px] text-ink-body">{m.label}</span>
                <span className="ml-auto font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
          {/* Alone: the only useful action is getting people in, so that's
              the only button. Once someone else has joined, swap to the
              richer nudge/group-text tools — showing both at once was just
              clutter for a trip of one. */}
          <div className="mt-4 flex flex-col gap-3">
            {roster.length <= 1 ? (
              <div className="flex flex-col gap-3">
                {joinInvite && (
                  <div>
                    <p className="mb-2 text-[14px] text-body">Send this link to bring your travelers in.</p>
                    <CopyInviteLink url={`${siteUrl}/planner/join/${joinInvite.token}`} />
                  </div>
                )}
                {trip.join_code && (
                  <div>
                    <p className="mb-2 text-[14px] text-body">Or share this join code.</p>
                    <CopyJoinCode code={trip.join_code} smsNumber={smsNumber} />
                  </div>
                )}
              </div>
            ) : (
              <>
                <StartGroupText tripId={id} started={Boolean(trip.twilio_conversation_sid)} />
                <NudgeButton tripId={id} />
              </>
            )}
          </div>
        </div>

        {trip.preferences_skipped_at && membership.role === "owner" && (
          <PreferencesSkipControl tripId={id} skipped />
        )}

        {!myPref && !trip.preferences_skipped_at && (
          <div className="mb-8 flex items-center justify-between gap-6 rounded-2xl border border-warm-border bg-warm-bg p-6.5">
            <div>
              <p className="mb-1.5 text-xl font-display text-ink">
                What would make this trip good for you?
              </p>
              <p className="text-[15px] text-body">
                Four quick questions — budget, pace, and the one thing you
                wouldn&rsquo;t compromise on.
              </p>
              {membership.role === "owner" && <PreferencesSkipControl tripId={id} skipped={false} />}
            </div>
            <Link
              href={`/planner/trips/${id}/preferences`}
              className="rounded-full bg-ink px-6 py-3 text-[15px] whitespace-nowrap text-cream hover:bg-accent"
            >
              Add my preferences
            </Link>
          </div>
        )}

        <div id="itinerary" className="mb-14">
          <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
            <span className="font-mono text-[11px] text-faint">02</span>
            <span className="text-[25px] font-display text-ink">The plan so far</span>
            {daysWithItems.length > 0 && (
              <span className="ml-auto text-[13.5px] text-muted">
                Each day has its own colour on the map
              </span>
            )}
          </div>
          {daysWithItems.length > 0 ? (
            <ItineraryBoard
              tripId={id}
              days={daysWithItems}
              hasUnscheduledPlaces={places.some((p) => !p.day_id)}
            />
          ) : (
            <div className="mb-14 rounded-2xl border border-dashed border-input-border p-7 text-center">
              <p className="mb-1.5 font-display text-xl text-ink">No dates yet</p>
              <p className="text-[15px] text-body">
                Once this trip has dates, the day-by-day plan builds itself here.
              </p>
            </div>
          )}
        </div>

        <PlacesBoard
          tripId={id}
          days={days}
          places={places}
          googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
          myDisplayName={user.name || user.email?.split("@")[0] || "Someone"}
        />

        <StaysSection tripId={id} stayDecision={stayDecision} myUserId={user.id} totalMembers={roster.length} />

        <DecisionsSection tripId={id} decisions={decisions} totalMembers={roster.length} />

        <SourcesSection resources={resources} />
      </div>
    </div>
  );
}
