import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { CopyInviteLink } from "./CopyInviteLink";
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
import { ResourceTile } from "@/components/planner/ResourceIcon";
import { WorkspaceTopBar } from "./WorkspaceTopBar";
import { TripVisibilityToggle } from "./TripVisibilityToggle";
import { ensureDays } from "@/lib/planner/days";
import { DAY_COLORS } from "@/lib/planner/itinerary";
import { formatPhoneDisplay } from "@/lib/planner/phone";
import { computeAttention } from "@/lib/planner/attention";
import type { PlannerItineraryItem } from "@/lib/supabase/planner-types";

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
    { data: resourceRows },
    { data: placeRows },
    { data: decisionRows },
    attention,
  ] = await Promise.all([
    admin.from("planner_memberships").select("role").eq("trip_id", id).eq("user_id", user.id).maybeSingle(),
    admin.from("planner_trips").select("*").eq("id", id).maybeSingle(),
    admin.from("planner_memberships").select("role, planner_users(name, email, phone)").eq("trip_id", id),
    admin.from("planner_invites").select("token").eq("trip_id", id).eq("channel", "link").limit(1).maybeSingle(),
    admin.from("planner_preferences").select("trip_id").eq("trip_id", id).eq("user_id", user.id).maybeSingle(),
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

  const resourceLabelById = new Map(
    (resourceRows ?? []).map((r) => [r.id as string, r.label as string])
  );

  const places = (placeRows ?? []).map((p) => {
    const person = p.planner_users as unknown as {
      name: string | null;
      email: string | null;
    } | null;
    const who = person?.name || person?.email?.split("@")[0] || "Someone";
    const sourceLabel = p.resource_id ? (resourceLabelById.get(p.resource_id) ?? null) : null;
    return { ...p, who, sourceLabel };
  });

  const resources = (resourceRows ?? []).map((r) => {
    const person = r.planner_users as unknown as {
      name: string | null;
      email: string | null;
    } | null;
    const who = person?.name || person?.email?.split("@")[0] || "Someone";
    const placeNames = places.filter((p) => p.resource_id === r.id).map((p) => p.name);
    return { ...r, who, placeNames };
  });

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

  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase()}–${new Date(trip.end_date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric" }).toUpperCase()}`
      : null;

  return (
    <div className="min-h-screen">
      <WorkspaceTopBar
        tripId={id}
        tripName={trip.name}
        dateRange={dateRange}
        travellerCount={roster.length}
        roster={roster}
        avatarColors={AVATAR_COLORS}
        datesLabel={trip.dates_locked_at ? "Dates" : "Pick dates"}
        primary={attention.primary}
        navCounts={{
          places: places.length,
          stays: stayCount,
          sources: resources.length,
          decisions: generalCount,
          decisionsNeedVote,
        }}
      />

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
          <div className="flex items-center gap-2.5">
            <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
              {trip.privacy === "private" ? "Private trip" : "Open trip"}
            </p>
            {membership.role === "owner" && (
              <TripVisibilityToggle tripId={id} initialIsPublic={trip.is_public} />
            )}
          </div>
        </div>

        {attention.items.length > 0 && (
          <div className="mb-10 flex flex-col gap-1.5">
            {attention.items.map((item, i) => (
              <a
                key={item.kind}
                href={item.href}
                className="flex items-center gap-2.5 text-[14px] text-body hover:text-accent"
              >
                <span className="font-mono text-[10px] tracking-[0.08em] text-faint uppercase">
                  {i === 0 ? "First" : "Then"}
                </span>
                {item.label}
              </a>
            ))}
          </div>
        )}

        {membership.role === "owner" && joinInvite && (
          <div className="mb-12">
            <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
              <span className="font-mono text-[11px] text-faint">01</span>
              <span className="text-[25px] font-display text-ink">Invite the group</span>
            </div>
            <CopyInviteLink url={`${siteUrl}/planner/join/${joinInvite.token}`} />
          </div>
        )}

        <div className="mb-12">
          <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
            <span className="font-mono text-[11px] text-faint">02</span>
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
          <div className="mt-4 flex flex-col gap-3">
            <StartGroupText tripId={id} started={Boolean(trip.twilio_conversation_sid)} />
            <NudgeButton tripId={id} />
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
            <span className="font-mono text-[11px] text-faint">03</span>
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
        />

        <StaysSection tripId={id} stayDecision={stayDecision} myUserId={user.id} totalMembers={roster.length} />

        {resources.length > 0 && (
          <div id="resources" className="mb-14 max-w-[760px]">
            <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
              <span className="font-mono text-[11px] text-faint">06</span>
              <span className="text-[25px] font-display text-ink">Where these came from</span>
              <span className="ml-auto text-[13.5px] text-muted">
                Links, text, and screenshots
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {resources.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-3.5 py-3"
                >
                  <ResourceTile type={r.type} sourceUrl={r.source_url} />
                  <div className="min-w-0">
                    <div className="text-[14.5px] text-[#2B2825]">{r.label}</div>
                    <div className="mt-0.5 text-[12.5px] text-muted">
                      {r.placeNames.length > 0 ? r.placeNames.join(", ") : "Nothing kept"} &middot;
                      {" "}added by {r.who}
                    </div>
                  </div>
                  <div className="ml-auto rounded-full border border-border font-mono text-[10px] tracking-[0.08em] text-muted uppercase whitespace-nowrap px-2.5 py-1">
                    {r.type}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DecisionsSection tripId={id} decisions={decisions} totalMembers={roster.length} />
      </div>
    </div>
  );
}
