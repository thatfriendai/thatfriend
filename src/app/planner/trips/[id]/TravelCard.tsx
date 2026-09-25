"use client";

import { useState } from "react";
import { DAY_COLORS } from "@/lib/planner/itinerary";
import { addMinutes, closestCluster, clusterLine, hhmm, joinNames, minutesOf } from "@/lib/planner/travel";
import type { PlannerRideGroup, PlannerTravelLeg, TravelDirection } from "@/lib/supabase/planner-types";

type Person = { userId: string; label: string };

function first(label: string) {
  return label.split(/\s+/)[0];
}

function initials(label: string) {
  const letters = label
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}]/gu, "")[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return letters || "?";
}

function dayHeading(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}`.toUpperCase();
}

/**
 * The card that opens the itinerary rail (arrivals) or closes it
 * (departures): who lands when and on what, who hasn't said yet, who lands
 * close enough together to share a ride — and the ride groups tagged on
 * top of that. Everyone adds their own leg.
 */
export function TravelCard({
  tripId,
  direction,
  cardDate,
  city,
  roster,
  myUserId,
  initialLegs,
  initialRides,
}: {
  tripId: string;
  direction: TravelDirection;
  cardDate: string;
  city: string | null;
  roster: Person[];
  myUserId: string;
  initialLegs: PlannerTravelLeg[];
  initialRides: PlannerRideGroup[];
}) {
  const [legs, setLegs] = useState(initialLegs);
  const [rides, setRides] = useState(initialRides);
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState("");
  const [date, setDate] = useState(cardDate);
  const [time, setTime] = useState("");
  const [tagging, setTagging] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [rideTime, setRideTime] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const arrive = direction === "arrive";
  const nameOf = new Map(roster.map((p) => [p.userId, first(p.label)]));
  const fullNameOf = new Map(roster.map((p) => [p.userId, p.label]));
  const colorOf = new Map(roster.map((p, i) => [p.userId, DAY_COLORS[i % DAY_COLORS.length]]));
  const sorted = [...legs].sort((a, b) => a.date.localeCompare(b.date) || minutesOf(a.time) - minutesOf(b.time));
  const mine = legs.find((l) => l.user_id === myUserId) ?? null;
  const missing = roster.filter((p) => p.userId !== myUserId && !legs.some((l) => l.user_id === p.userId));
  const cluster = closestCluster(legs);
  const inRide = new Set(rides.flatMap((r) => r.member_ids));

  function openEdit() {
    setDetail(mine?.detail ?? "");
    setDate(mine?.date ?? cardDate);
    setTime(mine ? hhmm(mine.time) : "");
    setEditing(true);
    setError(null);
  }

  async function saveLeg() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/travel`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction, detail, date, time }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save that.");
      return;
    }
    setLegs((list) => [...list.filter((l) => l.user_id !== myUserId), data.leg]);
    setEditing(false);
  }

  async function removeLeg() {
    setPending(true);
    const res = await fetch(`/api/v2/trips/${tripId}/travel`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    setPending(false);
    if (!res.ok) return;
    setLegs((list) => list.filter((l) => l.user_id !== myUserId));
    setEditing(false);
  }

  function suggestedTime(ids: string[]) {
    const times = legs.filter((l) => ids.includes(l.user_id)).map((l) => l.time);
    if (times.length === 0) return "";
    const sortedTimes = [...times].sort((a, b) => minutesOf(a) - minutesOf(b));
    // Arrivals: the last one's through the gate. Departures: two hours before the first leaves.
    return arrive ? addMinutes(sortedTimes[sortedTimes.length - 1], 10) : addMinutes(sortedTimes[0], -120);
  }

  function openTag() {
    const suggestion = (cluster ?? []).map((l) => l.user_id).filter((id) => !inRide.has(id));
    setPicked(suggestion);
    setRideTime(suggestedTime(suggestion));
    setTagging(true);
    setError(null);
  }

  function togglePick(id: string) {
    const next = picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id];
    setPicked(next);
    setRideTime(suggestedTime(next));
  }

  async function saveRide() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/rides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction, member_ids: picked, time: rideTime || null }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save that.");
      return;
    }
    setRides((list) => [...list, data.ride]);
    setTagging(false);
  }

  async function removeRide(id: string) {
    const res = await fetch(`/api/v2/trips/${tripId}/rides`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setRides((list) => list.filter((r) => r.id !== id));
  }

  const field =
    "w-full rounded-md border border-input-border bg-card px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-ink";

  return (
    <div className="rounded-[10px] border border-dashed border-line-dashed bg-card px-3.5 py-3.25" onClick={(e) => e.stopPropagation()}>
      <div className="mb-2.75 font-mono text-[10px] tracking-[0.1em] text-[#6B655C]">
        {dayHeading(cardDate)} &middot; {arrive ? "ARRIVALS" : "DEPARTURES"}
      </div>

      <div className="flex flex-col gap-2.25">
        {sorted.map((l) => {
          const who = nameOf.get(l.user_id) ?? "Someone";
          const isMe = l.user_id === myUserId;
          return (
            <div key={l.id} className="flex items-center gap-2.5">
              <span
                className="flex h-5.5 w-5.5 flex-none items-center justify-center rounded-full font-mono text-[9px] text-on-accent"
                style={{ background: colorOf.get(l.user_id) ?? "var(--color-ink-muted)" }}
              >
                {initials(fullNameOf.get(l.user_id) ?? who)}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] leading-[1.3] text-[#2B2825]">{isMe ? `${who} (you)` : who}</div>
                <div className="mt-0.5 text-[11.5px] text-muted">
                  {l.detail}
                  {l.date !== cardDate ? ` · ${dayHeading(l.date).slice(0, 6).trim()}` : ""}
                </div>
              </div>
              <div className="ml-auto flex-none font-mono text-[12px] text-ink-soft">{hhmm(l.time)}</div>
            </div>
          );
        })}

        {missing.length > 0 && (
          <div className="flex items-center gap-2.5">
            <span className="h-5.5 w-5.5 flex-none rounded-full border border-dashed border-[#DDD6C8]" />
            <span className="text-[11.5px] leading-[1.45] text-faint">
              {joinNames(missing.map((p) => first(p.label)))} {missing.length === 1 ? "hasn't" : "haven't"} added theirs.
            </span>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
          <input
            autoFocus
            className={field}
            value={detail}
            maxLength={120}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={arrive ? "e.g. TP 1234 from Gatwick" : "e.g. TP 1235 to Gatwick"}
          />
          <div className="flex gap-1.5">
            <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
            <input type="time" className={`${field} max-w-[108px]`} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={saveLeg}
              disabled={pending || !detail.trim() || !date || !time}
              className="rounded-full bg-ink px-3 py-1.5 text-[11.5px] text-cream hover:bg-accent disabled:opacity-50"
            >
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-[11.5px] text-faint hover:text-ink">
              Cancel
            </button>
            {mine && (
              <button type="button" onClick={removeLeg} className="ml-auto text-[11.5px] text-faint hover:text-red-700">
                Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <button type="button" onClick={openEdit} className="mt-2.5 text-[12px] text-ink-soft hover:text-accent">
          {mine ? `Edit your ${arrive ? "arrival" : "departure"}` : `+ Add your ${arrive ? "arrival" : "departure"}`}
        </button>
      )}

      {cluster && (
        <div className="mt-3 border-t border-line pt-2.5 text-[12px] leading-normal text-ink-soft">
          {clusterLine(
            direction,
            cluster.map((l) => nameOf.get(l.user_id) ?? "Someone"),
            cluster[0].time,
            cluster[cluster.length - 1].time,
            city
          )}
        </div>
      )}

      {legs.length >= 2 && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {rides.map((r, i) => (
            <div key={r.id} className="group flex items-center gap-2 rounded-lg bg-canvas px-2.25 py-1.75">
              <span className="flex-none font-mono text-[9.5px] tracking-[0.08em] text-[#6B655C] uppercase">Ride {i + 1}</span>
              <span className="min-w-0 text-[12px] leading-[1.35] text-[#2B2825]">
                {r.member_ids.map((id) => nameOf.get(id) ?? "Someone").join(", ")}
              </span>
              {r.time && <span className="ml-auto flex-none font-mono text-[11px] text-ink-soft">{hhmm(r.time)}</span>}
              <button
                type="button"
                onClick={() => removeRide(r.id)}
                aria-label={`Remove ride ${i + 1}`}
                className={`${r.time ? "" : "ml-auto"} flex-none text-[13px] leading-none text-faint opacity-0 group-hover:opacity-100 hover:text-red-700 focus:opacity-100`}
              >
                ×
              </button>
            </div>
          ))}

          {tagging ? (
            <div className="flex flex-col gap-2 rounded-lg border border-line bg-canvas p-2.5">
              <div className="flex flex-wrap gap-1.5">
                {sorted.map((l) => {
                  const on = picked.includes(l.user_id);
                  return (
                    <button
                      key={l.user_id}
                      type="button"
                      onClick={() => togglePick(l.user_id)}
                      className={`rounded-full border px-2.5 py-1 text-[11.5px] ${
                        on ? "border-ink bg-ink text-on-dark" : "border-input-border bg-card text-ink-soft hover:border-ink"
                      }`}
                    >
                      {nameOf.get(l.user_id)} &middot; {hhmm(l.time)}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] text-muted">{arrive ? "Leaving the airport at" : "Heading off at"}</span>
                <input type="time" className={`${field} max-w-[108px]`} value={rideTime} onChange={(e) => setRideTime(e.target.value)} />
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={saveRide}
                  disabled={pending || picked.length < 2}
                  className="rounded-full bg-ink px-3 py-1.5 text-[11.5px] text-cream hover:bg-accent disabled:opacity-50"
                >
                  Tag Ride {rides.length + 1}
                </button>
                <button type="button" onClick={() => setTagging(false)} className="text-[11.5px] text-faint hover:text-ink">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={openTag} className="self-start py-0.5 text-[12px] text-ink-soft hover:text-accent">
              + Tag a ride group
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-red-700">{error}</p>}
    </div>
  );
}
