"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AvailabilityCalendar } from "@/components/planner/AvailabilityCalendar";
import type { DateCoverageDay, DateProposal } from "@/lib/planner/dates";
import { DAY_COLORS } from "@/lib/planner/itinerary";

const AVATAR_COLORS = DAY_COLORS;

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const monthName = (d: Date) => d.toLocaleDateString(undefined, { month: "long" });
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) return `${s.getDate()}–${e.getDate()} ${monthName(e)}`;
  return `${s.getDate()} ${monthName(s)} – ${e.getDate()} ${monthName(e)}`;
}

function formatShort(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function bucket(count: number, total: number) {
  if (count <= 0) return 0;
  if (count >= total) return 4;
  if (count === total - 1) return 3;
  if (count >= Math.ceil(total / 2)) return 2;
  return 1;
}

const BUCKET_COLORS = ["transparent", "#EAF0E8", "#C7D9C2", "#9BBB92", "#6E8C6A"];

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
  datesLockedAt,
  lockedStart,
  lockedEnd,
  flagNote,
  flaggedAt,
  proposal,
  coverage,
  totalMembers,
  answered,
  myMarks,
}: {
  tripId: string;
  tripName: string;
  isOwner: boolean;
  datesLockedAt: string | null;
  lockedStart: string | null;
  lockedEnd: string | null;
  flagNote: string | null;
  flaggedAt: string | null;
  proposal: DateProposal | null;
  coverage: DateCoverageDay[];
  totalMembers: number;
  answered: { userId: string; label: string; answeredAt: string | null }[];
  myMarks: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [localMarks, setLocalMarks] = useState<string[]>(myMarks);
  const [savingMarks, setSavingMarks] = useState(false);
  const [locking, setLocking] = useState(false);
  const [showFlag, setShowFlag] = useState(false);
  const [flagDraft, setFlagDraft] = useState("");
  const [flagging, setFlagging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");

  const months = useMemo(() => buildHeatmapMonths(coverage), [coverage]);
  const answeredCount = answered.filter((a) => a.answeredAt).length;

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
    router.refresh();
  }

  async function lockProposal() {
    if (!proposal) return;
    setLocking(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/dates/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: proposal.start_date, end_date: proposal.end_date }),
    });
    setLocking(false);
    if (!res.ok) {
      setError("Could not lock these dates.");
      return;
    }
    router.refresh();
  }

  async function lockManual() {
    if (!manualStart || !manualEnd) return;
    setLocking(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/dates/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: manualStart, end_date: manualEnd }),
    });
    setLocking(false);
    if (!res.ok) {
      setError("Could not lock these dates.");
      return;
    }
    router.refresh();
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
    router.refresh();
  }

  async function sendFlag() {
    setFlagging(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/dates/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: flagDraft }),
    });
    setFlagging(false);
    if (!res.ok) {
      setError("Could not send that.");
      return;
    }
    setShowFlag(false);
    setFlagDraft("");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[900px] px-6 py-9.5 pb-28">
      <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
        {tripName} &middot; Dates
      </p>

      {datesLockedAt && lockedStart && lockedEnd ? (
        <>
          <h1 className="mb-3 text-4xl leading-[1.08] font-display tracking-tight text-ink">
            Dates are locked: {formatRange(lockedStart, lockedEnd)}.
          </h1>
          <p className="mb-8 max-w-xl text-base leading-relaxed text-body">
            The itinerary is building itself around these days now.
          </p>
        </>
      ) : proposal ? (
        <>
          <h1 className="mb-3 text-4xl leading-[1.08] font-display tracking-tight text-ink">
            {proposal.score >= totalMembers
              ? `Everyone marked what worked. One stretch worked for all ${totalMembers}.`
              : `Not everyone overlaps yet. Here's what works for the most.`}
          </h1>
          <p className="mb-8 max-w-xl text-base leading-relaxed text-body">
            Nobody had to agree to a date. They marked the days they were
            free and the overlap did the rest.
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

      {!datesLockedAt && isOwner && (
        <div className="mb-10">
          {!showManual ? (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="text-[13.5px] text-muted underline hover:text-accent"
            >
              Already confirmed your dates elsewhere? Skip collecting availability
            </button>
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
                  className="rounded-full border border-input-border bg-cream px-4 py-2 text-[14.5px] text-ink outline-none focus:border-ink"
                />
                <span className="text-muted">to</span>
                <input
                  type="date"
                  value={manualEnd}
                  onChange={(e) => setManualEnd(e.target.value)}
                  min={manualStart || undefined}
                  className="rounded-full border border-input-border bg-cream px-4 py-2 text-[14.5px] text-ink outline-none focus:border-ink"
                />
                <button
                  type="button"
                  onClick={lockManual}
                  disabled={locking || !manualStart || !manualEnd}
                  className="rounded-full bg-ink px-5.5 py-2.5 text-[14.5px] text-cream hover:bg-accent disabled:opacity-50"
                >
                  {locking ? "Locking…" : "Lock these dates"}
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
              Ready to lock
            </span>
          </div>
          <p className="mb-2 text-2xl font-display text-ink">
            {formatRange(proposal.start_date, proposal.end_date)}
          </p>
          <p className="mb-4 text-[15px] leading-relaxed text-body">
            {proposal.score >= totalMembers
              ? `All ${totalMembers} of you are free across these days.`
              : `This ${proposal.label} of you.`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {isOwner && (
              <button
                type="button"
                onClick={lockProposal}
                disabled={locking}
                className="rounded-full bg-ink px-5.5 py-2.5 text-[14.5px] text-cream hover:bg-accent disabled:opacity-50"
              >
                {locking ? "Locking…" : "Looks right"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFlag((v) => !v)}
              className="rounded-full border border-input-border bg-card px-5 py-2.5 text-[14.5px] text-ink hover:border-ink"
            >
              Raise a flag
            </button>
            {!isOwner && (
              <span className="text-[13px] text-muted">The trip owner can lock or unlock it either way</span>
            )}
          </div>
          {showFlag && (
            <div className="mt-4 flex flex-col gap-2.5 border-t border-warm-border pt-4">
              <textarea
                value={flagDraft}
                onChange={(e) => setFlagDraft(e.target.value)}
                placeholder="What's off about it?"
                rows={2}
                className="w-full resize-y rounded-xl border border-input-border bg-card px-4 py-3 text-[14.5px] text-ink outline-none focus:border-ink"
              />
              <button
                type="button"
                onClick={sendFlag}
                disabled={flagging}
                className="self-start rounded-full border border-input-border bg-card px-5 py-2 text-[13.5px] text-ink hover:border-ink disabled:opacity-50"
              >
                {flagging ? "Sending…" : "Send"}
              </button>
            </div>
          )}
        </div>
      )}

      {datesLockedAt && isOwner && (
        <div className="mb-10">
          <button
            type="button"
            onClick={unlock}
            disabled={locking}
            className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase hover:text-ink disabled:opacity-50"
          >
            {locking ? "Unlocking…" : "Unlock and change dates"}
          </button>
        </div>
      )}

      {flaggedAt && !datesLockedAt && (
        <p className="mb-8 text-[14px] text-muted">
          A flag was raised{flagNote ? `: “${flagNote}”` : "."}
        </p>
      )}

      {error && <p className="mb-6 text-sm text-red-700">{error}</p>}

      <div className="mb-12">
        <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
          <span className="font-mono text-[11px] text-[#C0B8A8]">01</span>
          <span className="text-[25px] font-display text-ink">Who&rsquo;s free when</span>
          <div className="ml-auto flex items-center gap-3 font-mono text-[10px] tracking-[0.06em] text-muted uppercase">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm border border-border-soft" style={{ background: BUCKET_COLORS[1] }} />
              One or two
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BUCKET_COLORS[2] }} />
              Some
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BUCKET_COLORS[3] }} />
              Most
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BUCKET_COLORS[4] }} />
              All {totalMembers}
            </span>
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
                    return (
                      <span
                        key={cell.iso}
                        title={`${cell.count} of ${totalMembers} free`}
                        className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md text-[12.5px] text-ink-body ${
                          inProposal ? "outline outline-2 outline-offset-[-2px] outline-accent" : ""
                        }`}
                        style={{ background: BUCKET_COLORS[bucket(cell.count, totalMembers)] }}
                      >
                        {Number(cell.iso.slice(-2))}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-12">
        <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
          <span className="font-mono text-[11px] text-[#C0B8A8]">02</span>
          <span className="text-[25px] font-display text-ink">Everyone answered</span>
          <span className="ml-auto text-[13.5px] text-muted">
            {answeredCount} of {totalMembers} answered
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {answered.map((m, i) => (
            <div
              key={m.userId}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] text-cream"
                style={{ background: m.answeredAt ? AVATAR_COLORS[i % AVATAR_COLORS.length] : "#C0B8A8" }}
              >
                {initialsOf(m.label)}
              </div>
              <span className="text-[15px] text-ink-body">{m.label}</span>
              <span className="ml-auto text-[12.5px] text-muted">
                {m.answeredAt ? `Answered ${formatShort(m.answeredAt.slice(0, 10))}` : "Not yet"}
              </span>
            </div>
          ))}
        </div>
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
