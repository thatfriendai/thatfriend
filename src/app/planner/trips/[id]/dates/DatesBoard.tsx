"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { daysBetween } from "@/lib/planner/calendarDate";
import { AvailabilityCalendar } from "@/components/planner/AvailabilityCalendar";
import { CopyJoinCode } from "../CopyJoinCode";
import { celebrateDecisionClosed } from "@/lib/planner/confetti";
import type { DateCoverageDay, DateProposal } from "@/lib/planner/dates";
import { DATE_FLAG_REASONS, type DateFlagReason } from "@/lib/supabase/planner-types";

// One colour per person for the heatmap dots — the design's avatar set,
// picked to stay distinct from each other at 5px. Green goes last since
// the cells themselves are green.
const PERSON_COLORS = ["#8A5A7A", "#C9A227", "#3F6E7A", "#B4664A", "#4A453E", "#6E7F8C", "#6E8C6A"];

function formatRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const monthName = (d: Date) => d.toLocaleDateString(undefined, { month: "long" });
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) return `${s.getDate()}–${e.getDate()} ${monthName(e)}`;
  return `${s.getDate()} ${monthName(s)} – ${e.getDate()} ${monthName(e)}`;
}

function dayCount(start: string, end: string) {
  const ms = new Date(end + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime();
  return Math.round(ms / 86400000) + 1;
}

// "Nina" / "Nina and Tom" / "Nina, Tom and Priya" — no Oxford comma, matches
// the rest of the app's list copy (e.g. nudge.ts's group-text names).
function joinNames(names: string[]) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function firstName(label: string) {
  return label.split(/\s+/)[0];
}

// The heatmap is everyone's marks stacked: each person who's free on a day
// adds an equal share of green, so the shade is the sum of their marks
// rather than a fixed ramp of buckets.
const HEAT = "#6E8C6A";
function heatColor(count: number, total: number) {
  if (count <= 0 || total <= 0) return "transparent";
  return `color-mix(in srgb, ${HEAT} ${Math.round((Math.min(count, total) / total) * 100)}%, #F4F1E9)`;
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function buildHeatmapMonths(coverage: DateCoverageDay[]) {
  const byDate = new Map(coverage.map((c) => [c.date, c.count]));
  const months = [...new Set(coverage.map((c) => monthKey(c.date)))].sort();
  return months.map((key) => {
    const [y, m] = key.split("-").map(Number);
    const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: { iso: string; count: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${key}-${String(d).padStart(2, "0")}`;
      cells.push({ iso, count: byDate.get(iso) ?? 0 });
    }
    return { key, y, m, firstWeekday, cells };
  });
}

export function DatesBoard({
  tripId,
  tripName,
  isOwner,
  myUserId,
  joinCode,
  smsNumber,
  datesLockedAt,
  lockedStart,
  lockedEnd,
  flagNote,
  flagReason,
  flaggedAt,
  flaggedByName,
  proposal,
  coverage,
  totalMembers,
  answered,
  myMarks,
  freeByDate,
  onChanged,
}: {
  tripId: string;
  tripName: string;
  isOwner: boolean;
  myUserId: string;
  joinCode: string | null;
  smsNumber: string | null;
  datesLockedAt: string | null;
  lockedStart: string | null;
  lockedEnd: string | null;
  flagNote: string | null;
  flagReason: string | null;
  flaggedAt: string | null;
  flaggedByName: string | null;
  proposal: DateProposal | null;
  coverage: DateCoverageDay[];
  totalMembers: number;
  answered: { userId: string; label: string; answeredAt: string | null }[];
  myMarks: string[];
  freeByDate: Record<string, string[]>;
  /**
   * Called after anything here changes the dates. The standalone page gets
   * fresh props from router.refresh(), but the trip-page modal renders
   * this from its own fetched copy — without re-reading it, the modal kept
   * offering "Confirm these dates" after they were confirmed.
   */
  onChanged?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [localMarks, setLocalMarks] = useState<string[]>(myMarks);
  const [savingMarks, setSavingMarks] = useState(false);
  const [locking, setLocking] = useState(false);
  // A ref, not just the `locking` state: two quick clicks both run before
  // React re-renders the button disabled, and each lock texts the group.
  const lockInFlight = useRef(false);
  // Fresh lock state from the server (locked here, or unlocked from another
  // tab or the modal) means any in-flight lock has landed.
  useEffect(() => {
    lockInFlight.current = false;
  }, [datesLockedAt]);
  const [showFlag, setShowFlag] = useState(false);
  const [flagDraft, setFlagDraft] = useState("");
  const [flagReasonPick, setFlagReasonPick] = useState<DateFlagReason | null>(null);
  const [flagging, setFlagging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [nudging, setNudging] = useState(false);
  const [nudgeResult, setNudgeResult] = useState<string | null>(null);

  const months = useMemo(() => buildHeatmapMonths(coverage), [coverage]);
  // Local, not UTC — "today" in the evening shouldn't already be tomorrow.
  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const colorByUser = new Map(answered.map((m, i) => [m.userId, PERSON_COLORS[i % PERSON_COLORS.length]]));
  const labelByUser = new Map(answered.map((m) => [m.userId, m.label]));
  const answeredCount = answered.filter((a) => a.answeredAt).length;
  const notAnswered = answered.filter((a) => !a.answeredAt && a.userId !== myUserId);
  const notAnsweredNames = joinNames(notAnswered.map((a) => firstName(a.label)));

  const iHaveAnswered = myMarks.length > 0;
  const isFull = Boolean(proposal && proposal.score >= totalMembers);
  const isSolo = !isFull && iHaveAnswered && answeredCount <= 1;
  const isPartial = !isFull && !isSolo && answeredCount > 0;

  const heatNote =
    datesLockedAt && lockedStart && lockedEnd
      ? `The outlined block is ${formatRange(lockedStart, lockedEnd)}, the dates you confirmed. Darker days mean more people free.`
      : answeredCount <= 1 && iHaveAnswered
        ? "Your days only. Everyone else's marks stack on top of these as they answer."
        : proposal
          ? `The outlined block is where ${
              proposal.score >= totalMembers ? `all ${totalMembers}` : `${proposal.score}`
            } of you are free. Darker days mean more people free.`
          : "Darker days mean more people free.";

  // Counted from the local today above, not UTC's — which is already
  // tomorrow in the evening across the Americas.
  const daysUntilStart =
    !datesLockedAt || !lockedStart || lockedStart < todayLocal ? null : daysBetween(todayLocal, lockedStart);

  // Re-read whatever renders this (the modal's copy, via onChanged) as
  // well as the server page behind it.
  async function refreshAll() {
    await onChanged?.();
    router.refresh();
  }

  async function nudgeAvailability() {
    setNudging(true);
    setNudgeResult(null);
    const res = await fetch(`/api/v2/trips/${tripId}/nudge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "availability", mode: "individual" }),
    });
    const data = await res.json().catch(() => ({}));
    setNudging(false);
    setNudgeResult(data.error ?? (data.sentCount !== undefined ? "sent" : null));
  }

  async function saveMarks() {
    setSavingMarks(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/availability`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates: localMarks }),
    });
    setSavingMarks(false);
    if (!res.ok) {
      setError("Could not save your days.");
      return;
    }
    setEditing(false);
    await refreshAll();
  }

  async function lock(start: string, end: string) {
    if (lockInFlight.current) return;
    lockInFlight.current = true;
    setLocking(true);
    setError(null);
    let ok = false;
    try {
      const res = await fetch(`/api/v2/trips/${tripId}/dates/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: start, end_date: end }),
      });
      ok = res.ok;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not lock these dates.");
      } else {
        celebrateDecisionClosed();
        await refreshAll();
      }
    } catch {
      setError("Could not lock these dates — check your connection and try again.");
    } finally {
      setLocking(false);
      // After a successful lock the guard stays up until the new props
      // arrive (the effect on datesLockedAt below lowers it) — until then a
      // stale "Confirm these dates" could be pressed again and re-text
      // the group.
      if (!ok) lockInFlight.current = false;
    }
  }

  async function lockProposal() {
    if (!proposal) return;
    await lock(proposal.start_date, proposal.end_date);
  }

  async function lockManual() {
    if (!manualStart || !manualEnd) return;
    await lock(manualStart, manualEnd);
  }

  async function unlock() {
    setLocking(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/dates/lock`, { method: "DELETE" });
    setLocking(false);
    if (!res.ok) {
      setError("Could not unlock dates.");
      return;
    }
    lockInFlight.current = false;
    await refreshAll();
  }

  async function sendFlag() {
    setFlagging(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/dates/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: flagDraft, reason: flagReasonPick }),
    });
    setFlagging(false);
    if (!res.ok) {
      setError("Could not send that.");
      return;
    }
    setShowFlag(false);
    setFlagDraft("");
    setFlagReasonPick(null);
    await refreshAll();
  }

  return (
    <div className="mx-auto max-w-[900px] px-6 py-9.5 pb-28">
      <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
        {tripName} &middot; Dates
      </p>

      {datesLockedAt && lockedStart && lockedEnd ? (
        <>
          <h1 className="mb-3 text-4xl leading-[1.08] font-display tracking-tight text-ink">
            Dates confirmed: {formatRange(lockedStart, lockedEnd)}.
          </h1>
          <p className="mb-8 max-w-xl text-base leading-relaxed text-body">
            The itinerary is building itself around these days now.
          </p>
        </>
      ) : isFull ? (
        <>
          <h1 className="mb-3 text-4xl leading-[1.08] font-display tracking-tight text-ink">
            One stretch works for all {totalMembers} of you.
          </h1>
          <p className="mb-8 max-w-xl text-base leading-relaxed text-body">
            Nobody agreed on a date — the overlap did it.
          </p>
        </>
      ) : isPartial ? (
        <>
          <h1 className="mb-3 text-4xl leading-[1.08] font-display tracking-tight text-ink">
            {answeredCount} of {totalMembers} added their dates.
          </h1>
          <p className="mb-8 max-w-xl text-base leading-relaxed text-body">
            {notAnsweredNames
              ? `Waiting on ${notAnsweredNames}. The overlap updates as they answer.`
              : "The overlap updates as more people answer."}
          </p>
        </>
      ) : isSolo ? (
        <>
          <h1 className="mb-3 text-4xl leading-[1.08] font-display tracking-tight text-ink">
            You added your dates.
          </h1>
          <p className="mb-8 max-w-xl text-base leading-relaxed text-body">
            Add your friends and their days stack on top of yours. The
            overlap picks the dates.
          </p>
        </>
      ) : (
        <>
          <h1 className="mb-3 text-4xl leading-[1.08] font-display tracking-tight text-ink">
            Nobody&rsquo;s overlapping yet.
          </h1>
          <p className="mb-8 max-w-xl text-base leading-relaxed text-body">
            Mark the days that could work for you below — once a couple of
            people have answered, the best stretch proposes itself.
          </p>
        </>
      )}

      {!datesLockedAt && isSolo && (
        <div className="mb-10">
          <CopyJoinCode tripId={tripId} code={joinCode} smsNumber={smsNumber} />
        </div>
      )}

      {!datesLockedAt && isPartial && (
        <div className="mb-10 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={nudgeAvailability}
            disabled={nudging || notAnswered.length === 0}
            className="rounded-full bg-ink px-5.5 py-2.5 text-[14.5px] text-cream hover:bg-accent disabled:opacity-50"
          >
            {nudging ? "Nudging…" : `Nudge ${notAnsweredNames || "the group"}`}
          </button>
          <span className="font-mono text-[12.5px] text-muted">
            {nudgeResult === "sent" ? "They get the same link again" : nudgeResult ?? ""}
          </span>
        </div>
      )}

      {!datesLockedAt && isOwner && (
        <div className="mb-10">
          {!showManual ? (
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6.5">
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[18px] text-ink-body">Already know the dates?</p>
                <p className="text-[15px] leading-relaxed text-body">
                  Skip collecting availability and set them yourself. You can always reopen it later.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="flex-none rounded-full border border-ink bg-card px-5.5 py-2.5 text-[14.5px] text-ink hover:bg-ink hover:text-cream"
              >
                Set the dates myself
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6.5">
              <p className="mb-3.5 text-[15px] text-body">
                Enter the dates you&rsquo;ve already settled on — no need to
                wait for everyone to mark their availability.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="date"
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  min={todayLocal}
                  className="rounded-full border border-input-border bg-cream px-4 py-2 text-[14.5px] text-ink outline-none focus:border-ink"
                />
                <span className="text-muted">to</span>
                <input
                  type="date"
                  value={manualEnd}
                  onChange={(e) => setManualEnd(e.target.value)}
                  min={manualStart || todayLocal}
                  className="rounded-full border border-input-border bg-cream px-4 py-2 text-[14.5px] text-ink outline-none focus:border-ink"
                />
                <button
                  type="button"
                  onClick={lockManual}
                  disabled={locking || !manualStart || !manualEnd}
                  className="rounded-full bg-ink px-5.5 py-2.5 text-[14.5px] text-cream hover:bg-accent disabled:opacity-50"
                >
                  {locking ? "Confirming…" : "Confirm these dates"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowManual(false)}
                  className="text-[13.5px] text-muted hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!datesLockedAt && proposal && (
        <div className="mb-10 rounded-2xl border border-warm-border bg-warm-bg p-6.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
              {isFull ? "Ready to confirm" : isPartial ? "Best overlap so far" : "Your days"}
            </span>
          </div>
          <p className="mb-2 text-2xl font-display text-ink">
            {formatRange(proposal.start_date, proposal.end_date)}
          </p>
          <p className="mb-4 text-[15px] leading-relaxed text-body">
            {isFull
              ? `All ${totalMembers} of you are free these ${dayCount(proposal.start_date, proposal.end_date)} days. Confirm them and the trip stops asking about dates — flights, stays and the itinerary all build on them. Anyone can still reopen it.`
              : isPartial
                ? `These ${dayCount(proposal.start_date, proposal.end_date)} days work for the ${proposal.score} who answered. They can still move.`
                : "The days you marked. This narrows once your friends mark theirs."}
          </p>
          {isFull && (
            <div className="flex flex-wrap items-center gap-3">
              {isOwner && (
                <button
                  type="button"
                  onClick={lockProposal}
                  disabled={locking}
                  className="rounded-full bg-ink px-5.5 py-2.5 text-[14.5px] text-cream hover:bg-accent disabled:opacity-50"
                >
                  {locking ? "Confirming…" : "Confirm these dates"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFlag((v) => !v)}
                className="rounded-full border border-input-border bg-card px-5 py-2.5 text-[14.5px] text-ink hover:border-ink"
              >
                Raise a flag
              </button>
              <span className="text-[13px] text-muted">
                {!isOwner
                  ? "The trip owner can confirm or reopen it either way"
                  : flaggedAt
                    ? `Flagged by ${flaggedByName ?? "someone"}: ${flagReason ?? ""}${flagReason && flagNote ? " — " : ""}${flagNote ?? ""}`
                    : "Nobody has flagged these dates"}
              </span>
            </div>
          )}
          {isPartial && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={nudgeAvailability}
                disabled={nudging || notAnswered.length === 0}
                className="rounded-full bg-ink px-5.5 py-2.5 text-[14.5px] text-cream hover:bg-accent disabled:opacity-50"
              >
                {nudging ? "Nudging…" : `Nudge ${notAnsweredNames || "the group"}`}
              </button>
              <span className="text-[13px] text-muted">Confirming opens once everyone has answered</span>
            </div>
          )}
          {isFull && showFlag && (
            <div className="mt-4 flex flex-col gap-3.5 border-t border-warm-border pt-4">
              <div>
                <p className="mb-1 text-[16px] text-ink-body">What doesn&rsquo;t work?</p>
                <p className="text-[14px] text-muted">The group sees this on the dates, so nobody re-asks.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {DATE_FLAG_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFlagReasonPick((cur) => (cur === r ? null : r))}
                    className={`rounded-full border px-4 py-2 text-[14px] ${
                      flagReasonPick === r ? "border-ink bg-ink text-cream" : "border-input-border bg-card text-ink-body"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={flagDraft}
                onChange={(e) => setFlagDraft(e.target.value)}
                placeholder="Add a detail, like which days are the problem"
                className="w-full rounded-xl border border-input-border bg-card px-4 py-3 text-[15px] text-ink outline-none focus:border-ink"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={sendFlag}
                  disabled={flagging}
                  className="rounded-full bg-ink px-5.5 py-2.5 text-[14.5px] text-cream hover:bg-accent disabled:opacity-50"
                >
                  {flagging ? "Sending…" : "Raise it with the group"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFlag(false);
                    setFlagDraft("");
                    setFlagReasonPick(null);
                  }}
                  className="rounded-full border border-input-border bg-card px-5 py-2.5 text-[14.5px] text-ink hover:border-ink"
                >
                  Never mind
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {datesLockedAt && lockedStart && (
        <div className="mb-10 rounded-2xl border border-ink bg-card p-6.5">
          <span className="font-mono text-[10.5px] tracking-[0.1em] text-muted uppercase">Next for the group</span>
          <div className="mt-3.5 flex flex-wrap items-center gap-3">
            <Link
              href={`/planner/trips/${tripId}#stays`}
              className="rounded-full bg-ink px-5.5 py-2.5 text-[14.5px] text-cream hover:bg-accent"
            >
              Decide where you stay
            </Link>
            {isOwner && (
              <button
                type="button"
                onClick={unlock}
                disabled={locking}
                className="rounded-full border border-input-border bg-card px-5 py-2.5 text-[14.5px] text-ink hover:border-ink disabled:opacity-50"
              >
                {locking ? "Reopening…" : "Reopen the dates"}
              </button>
            )}
            {daysUntilStart !== null && (
              <span className="text-[13.5px] text-muted">
                {daysUntilStart === 0 ? "Starts today" : `${daysUntilStart} day${daysUntilStart === 1 ? "" : "s"} until you leave`}
              </span>
            )}
          </div>
        </div>
      )}

      {error && <p className="mb-6 text-sm text-red-700">{error}</p>}

      <div className="mb-12">
        <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
          <span className="font-mono text-[11px] text-faint">01</span>
          <span className="text-[25px] font-display text-ink">Who&rsquo;s free when</span>
          {/* The key is the roster: one colour per person, matching their dots
              on each day. Anyone who hasn't marked days yet stays greyed out. */}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3.5 gap-y-1.5">
            {answered.map((m) => (
              <span
                key={m.userId}
                className={`flex items-center gap-1.5 text-[12.5px] ${m.answeredAt ? "text-body" : "text-faint"}`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={
                    m.answeredAt
                      ? { background: colorByUser.get(m.userId) }
                      : { border: "1px dashed #C0B8A8" }
                  }
                />
                {firstName(m.label)}
                {!m.answeredAt && " · not yet"}
              </span>
            ))}
          </div>
        </div>

        {months.length === 0 ? (
          <p className="text-[15px] text-muted">Nobody has marked their days yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            {months.map((mo) => (
              <div key={mo.key}>
                <p className="mb-2.5 text-sm font-medium text-ink">
                  {new Date(mo.y, mo.m - 1, 1).toLocaleDateString(undefined, { month: "long" })}
                </p>
                <div className="grid grid-cols-7 gap-y-1 text-center">
                  {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => (
                    <span key={i} className="font-mono text-[10px] text-faint">
                      {w}
                    </span>
                  ))}
                  {Array.from({ length: mo.firstWeekday }).map((_, i) => (
                    <span key={`pad-${i}`} />
                  ))}
                  {mo.cells.map((cell) => {
                    const inProposal =
                      proposal && cell.iso >= proposal.start_date && cell.iso <= proposal.end_date;
                    const free = freeByDate[cell.iso] ?? [];
                    return (
                      <span
                        key={cell.iso}
                        title={
                          free.length
                            ? `Free: ${joinNames(free.map((u) => firstName(labelByUser.get(u) ?? "Someone")))}`
                            : "Nobody free"
                        }
                        className={`mx-auto flex h-10 w-full max-w-10 flex-col items-center justify-center gap-[3px] rounded-md text-[12.5px] text-ink-body ${
                          inProposal ? "outline outline-2 outline-offset-[-2px] outline-ink" : ""
                        }`}
                        style={{ background: heatColor(cell.count, totalMembers) }}
                      >
                        {Number(cell.iso.slice(-2))}
                        {free.length > 0 && (
                          <span className="flex max-w-full flex-wrap justify-center gap-[2px] px-0.5">
                            {free.map((u) => (
                              <span
                                key={u}
                                className="h-[5px] w-[5px] rounded-full ring-1 ring-card"
                                style={{ background: colorByUser.get(u) }}
                              />
                            ))}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        {months.length > 0 && (
          <div className="mt-5 flex max-w-[780px] items-start gap-3 rounded-xl border border-warm-border bg-warm-bg px-4.5 py-3.5">
            <span
              className="mt-px h-5.5 w-5.5 flex-none rounded-md outline outline-2 outline-offset-[-2px] outline-ink"
              style={{ background: HEAT }}
            />
            <p className="text-[15px] leading-[1.55] text-ink-body">{heatNote}</p>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-8">
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-input-border bg-card px-5.5 py-2.5 text-[14.5px] text-ink hover:border-ink"
          >
            {myMarks.length > 0 ? "Change your days" : "Mark your days"}
          </button>
        ) : (
          <div>
            <p className="mb-3.5 text-base font-medium text-ink">
              Mark every day that could work for you
            </p>
            <AvailabilityCalendar value={localMarks} onChange={setLocalMarks} />
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={saveMarks}
                disabled={savingMarks}
                className="rounded-full bg-ink px-6 py-2.5 text-[14.5px] text-cream hover:bg-accent disabled:opacity-50"
              >
                {savingMarks ? "Saving…" : "Save my days"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setLocalMarks(myMarks);
                }}
                className="text-[14px] text-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
