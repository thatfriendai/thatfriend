"use client";

import { useEffect, useState, type ReactNode } from "react";
import { hashPercent } from "@/lib/planner/itinerary";
import { formatDayLabel } from "@/lib/planner/itinerary";
import type { PlannerDay, PlannerItineraryItem } from "@/lib/supabase/planner-types";

type DayWithItems = PlannerDay & { items: PlannerItineraryItem[] };

interface DraftPlace {
  id: string;
  name: string;
  kind: string;
  note: string | null;
  savedBy: string | null;
}

interface DayDraftState {
  places: DraftPlace[];
  reasoning: string;
  pending: boolean;
  error: string | null;
}

export function ItineraryBoard({
  tripId,
  days: initialDays,
  hasUnscheduledPlaces,
  railTop,
  railBottom,
}: {
  tripId: string;
  days: DayWithItems[];
  hasUnscheduledPlaces: boolean;
  /** Arrivals card, above the first day. */
  railTop?: ReactNode;
  /** Departures card, below the last day. */
  railBottom?: ReactNode;
}) {
  const [days, setDays] = useState(initialDays);
  const [selectedDayId, setSelectedDayId] = useState(initialDays[0]?.id ?? null);
  const [addingOnDay, setAddingOnDay] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [pending, setPending] = useState(false);
  const [dayDrafts, setDayDrafts] = useState<Record<string, DayDraftState>>({});
  const [forecast, setForecast] = useState<Record<string, string>>({});
  const [planBEditing, setPlanBEditing] = useState<string | null>(null);
  const [planBWhen, setPlanBWhen] = useState("");
  const [planBText, setPlanBText] = useState("");
  const [planBPending, setPlanBPending] = useState<string | null>(null);

  // Loaded after render so a slow forecast never holds up the page.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v2/trips/${tripId}/weather`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.forecast) setForecast(data.forecast);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  function replaceDay(day: PlannerDay) {
    setDays((list) => list.map((d) => (d.id === day.id ? { ...d, ...day } : d)));
  }

  async function savePlanB(dayId: string) {
    setPlanBPending(dayId);
    const res = await fetch(`/api/v2/trips/${tripId}/days/${dayId}/plan-b`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ when: planBWhen, text: planBText }),
    });
    setPlanBPending(null);
    if (!res.ok) return;
    replaceDay((await res.json()).day);
    setPlanBEditing(null);
  }

  async function togglePlanB(dayId: string, active: boolean) {
    setPlanBPending(dayId);
    const res = await fetch(`/api/v2/trips/${tripId}/days/${dayId}/plan-b`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setPlanBPending(null);
    if (!res.ok) return;
    replaceDay((await res.json()).day);
  }

  async function requestDraft(dayId: string, excludeIds: string[] = []) {
    setDayDrafts((d) => ({ ...d, [dayId]: { places: [], reasoning: "", pending: true, error: null } }));
    const res = await fetch(`/api/v2/trips/${tripId}/days/${dayId}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exclude_place_ids: excludeIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDayDrafts((d) => ({
        ...d,
        [dayId]: { places: [], reasoning: "", pending: false, error: data.error ?? "Could not draft this day." },
      }));
      return;
    }
    setDayDrafts((d) => ({
      ...d,
      [dayId]: { places: data.places, reasoning: data.reasoning, pending: false, error: null },
    }));
  }

  async function acceptDraft(dayId: string) {
    const draft = dayDrafts[dayId];
    if (!draft || draft.places.length === 0) return;
    const res = await fetch(`/api/v2/trips/${tripId}/days/${dayId}/draft/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place_ids: draft.places.map((p) => p.id) }),
    });
    if (!res.ok) return;
    const { items } = await res.json();
    setDays((list) => list.map((d) => (d.id === dayId ? { ...d, items: [...d.items, ...items] } : d)));
    setDayDrafts((d) => {
      const next = { ...d };
      delete next[dayId];
      return next;
    });
  }

  function dismissDraft(dayId: string) {
    setDayDrafts((d) => {
      const next = { ...d };
      delete next[dayId];
      return next;
    });
  }

  async function addItem(dayId: string) {
    const text = draftText.trim();
    if (!text) {
      setAddingOnDay(null);
      return;
    }
    setPending(true);
    const res = await fetch(`/api/v2/trips/${tripId}/itinerary/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_id: dayId, text }),
    });
    setPending(false);
    if (!res.ok) return;
    const { item } = await res.json();
    setDays((list) =>
      list.map((d) => (d.id === dayId ? { ...d, items: [...d.items, item] } : d))
    );
    setDraftText("");
    setAddingOnDay(null);
  }

  const pins = days.flatMap((d) =>
    d.items.map((item) => {
      const { x, y } = hashPercent(item.id);
      const on = d.id === selectedDayId;
      return { key: item.id, x, y, color: d.color, on };
    })
  );

  const selectedDay = days.find((d) => d.id === selectedDayId) ?? null;

  return (
    <div
      className="mb-14 grid grid-cols-1 overflow-hidden rounded-2xl border border-border lg:h-[460px] lg:[grid-template-columns:1.4fr_minmax(270px,0.85fr)]"
    >
      <div
        className="relative h-[220px] lg:h-auto"
        style={{
          background: "#EFEDE4",
          backgroundImage:
            "linear-gradient(#E6E3D7 1px, transparent 1px), linear-gradient(90deg, #E6E3D7 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(118deg, transparent 46%, #DCE6E3 46%)" }}
        />
        {pins.map((p, i) => {
          const size = p.on ? 24 : 11;
          return (
            <div
              key={p.key}
              className="absolute flex items-center justify-center rounded-full border-2 font-mono text-[11px] transition-all"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: size,
                height: size,
                margin: `${-size / 2}px 0 0 ${-size / 2}px`,
                background: p.color,
                color: "#FFFDF9",
                borderColor: "#FFFDF9",
                opacity: p.on ? 1 : 0.4,
                zIndex: p.on ? 2 : 1,
                boxShadow: `0 1px 4px rgba(27,25,23,${p.on ? 0.18 : 0.08})`,
              }}
            >
              {p.on ? i + 1 : ""}
            </div>
          );
        })}
        {selectedDay && (
          <div className="absolute bottom-3.5 left-3.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-[10.5px] text-ink-body">
            {formatDayLabel(selectedDay.date)}
            {selectedDay.city ? ` · ${selectedDay.city}` : ""}
          </div>
        )}
      </div>

      <div className="max-h-[420px] overflow-y-auto border-t border-border bg-[#FBF9F3] px-4 py-4.5 pb-7.5 lg:max-h-none lg:border-t-0 lg:border-l">
        <div className="mb-3.5 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
          Itinerary
        </div>
        <div className="flex flex-col gap-2">
          {railTop}
          {days.map((d) => {
            const on = d.id === selectedDayId;
            return (
              <div
                key={d.id}
                onClick={() => setSelectedDayId(d.id)}
                className="cursor-pointer rounded-[10px] px-3.5 py-3 transition-all"
                style={{
                  background: on ? "#FFFDF9" : "transparent",
                  border: `1px solid ${on ? "#DDD6C8" : "#EDE8DD"}`,
                  borderLeft: `3px solid ${on ? d.color : "transparent"}`,
                  boxShadow: on ? "0 1px 3px rgba(27,25,23,0.06)" : "none",
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 flex-none rounded-[3px]"
                    style={{ background: d.color, opacity: on ? 1 : 0.4 }}
                  />
                  <div className="font-mono text-[10.5px] tracking-[0.1em] text-[#6B655C]">
                    {formatDayLabel(d.date)}
                  </div>
                  <div className="ml-auto text-[11px] text-muted">{d.city ?? ""}</div>
                </div>
                {forecast[d.date] && (
                  <div className="-mt-0.5 mb-2 font-mono text-[10.5px] text-[#6B655C]">{forecast[d.date]}</div>
                )}
                {d.plan_b_active && (
                  <div className="mb-2 inline-block rounded-full bg-ink-soft px-2 py-[3px] font-mono text-[9.5px] tracking-[0.08em] text-on-accent uppercase">
                    On Plan B &middot; everyone notified
                  </div>
                )}
                {/* On Plan B the day reads as Plan B; the original moves to the row below. */}
                <div className="flex flex-col gap-1.5">
                  {d.plan_b_active && d.plan_b_text ? (
                    <div className="text-[13px] leading-[1.4] text-[#2B2825]">{d.plan_b_text}</div>
                  ) : (
                    d.items.map((item) => (
                      <div key={item.id} className="text-[13px] leading-[1.4] text-[#2B2825]">
                        {item.text}
                      </div>
                    ))
                  )}
                </div>

                {d.items.length === 0 && hasUnscheduledPlaces && (
                  <div onClick={(e) => e.stopPropagation()}>
                    {!dayDrafts[d.id] ? (
                      <button
                        onClick={() => requestDraft(d.id)}
                        className="mt-1.5 flex w-full items-center justify-between rounded-md border border-dashed border-input-border px-2.5 py-2 text-[12px] text-faint hover:border-accent hover:text-accent"
                      >
                        <span>Nothing planned</span>
                        <span>Draft a day</span>
                      </button>
                    ) : dayDrafts[d.id].pending ? (
                      <div className="mt-1.5 rounded-md border border-input-border px-2.5 py-2 text-[12px] text-faint">
                        Drafting…
                      </div>
                    ) : dayDrafts[d.id].error ? (
                      <div className="mt-1.5 rounded-md border border-input-border px-2.5 py-2 text-[12px] text-red-700">
                        {dayDrafts[d.id].error}
                      </div>
                    ) : (
                      <div className="mt-1.5 rounded-[10px] border-[1.5px] border-accent bg-warm-bg p-3">
                        <div className="mb-2 flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.1em] text-muted uppercase">
                          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "#8A5A7A" }} />
                          A draft
                        </div>
                        <div className="mb-2 flex flex-col gap-1">
                          {dayDrafts[d.id].places.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between rounded-md border border-warm-border bg-card px-2 py-1.5 text-[12px]"
                            >
                              <span className="text-[#2B2825]">{p.name}</span>
                              {p.savedBy && (
                                <span className="font-mono text-[9px] text-faint uppercase">saved by {p.savedBy}</span>
                              )}
                            </div>
                          ))}
                        </div>
                        {dayDrafts[d.id].reasoning && (
                          <p className="mb-2.5 text-[11.5px] leading-relaxed text-body">
                            {dayDrafts[d.id].reasoning}
                          </p>
                        )}
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => acceptDraft(d.id)}
                            disabled={dayDrafts[d.id].places.length === 0}
                            className="rounded-full bg-ink px-3 py-1.5 text-[11.5px] text-cream hover:bg-accent disabled:opacity-50"
                          >
                            Add this day
                          </button>
                          <button
                            onClick={() =>
                              requestDraft(
                                d.id,
                                dayDrafts[d.id].places.map((p) => p.id)
                              )
                            }
                            className="rounded-full border border-input-border px-3 py-1.5 text-[11.5px] text-ink hover:border-ink"
                          >
                            Try another
                          </button>
                          <button
                            onClick={() => dismissDraft(d.id)}
                            className="text-[11.5px] text-faint hover:text-ink"
                          >
                            Not now
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div onClick={(e) => e.stopPropagation()}>
                  {planBEditing === d.id ? (
                    <div className="mt-2.5 flex flex-col gap-1.5 border-t border-dashed border-[#DDD6C8] pt-2.5">
                      <input
                        autoFocus
                        value={planBWhen}
                        onChange={(e) => setPlanBWhen(e.target.value)}
                        placeholder="When — e.g. If it rains"
                        className="w-full rounded-md border border-input-border bg-card px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-ink"
                      />
                      <input
                        value={planBText}
                        onChange={(e) => setPlanBText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") savePlanB(d.id);
                          if (e.key === "Escape") setPlanBEditing(null);
                        }}
                        placeholder="What you'd do instead"
                        className="w-full rounded-md border border-input-border bg-card px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-ink"
                      />
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => savePlanB(d.id)}
                          disabled={planBPending === d.id}
                          className="rounded-full bg-ink px-3 py-1.5 text-[11.5px] text-cream hover:bg-accent disabled:opacity-50"
                        >
                          Save Plan B
                        </button>
                        <button onClick={() => setPlanBEditing(null)} className="text-[11.5px] text-faint hover:text-ink">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : d.plan_b_text ? (
                    <div className="mt-2.5 flex items-start gap-2 border-t border-dashed border-[#DDD6C8] pt-2.5">
                      <button
                        onClick={() => {
                          setPlanBEditing(d.id);
                          setPlanBWhen(d.plan_b_when ?? "");
                          setPlanBText(d.plan_b_text ?? "");
                        }}
                        className="min-w-0 flex-1 text-left"
                        title="Edit Plan B"
                      >
                        <div className="mb-0.5 font-mono text-[9.5px] tracking-[0.08em] text-[#6B655C] uppercase">
                          {d.plan_b_active ? "Plan A · the original" : `Plan B${d.plan_b_when ? ` · ${d.plan_b_when}` : ""}`}
                        </div>
                        <div className="text-[12px] leading-[1.4] text-ink-soft">
                          {d.plan_b_active ? d.items.map((i) => i.text).join(", ") || "Nothing planned" : d.plan_b_text}
                        </div>
                      </button>
                      <button
                        onClick={() => togglePlanB(d.id, !d.plan_b_active)}
                        title="Texts the group either way"
                        disabled={planBPending === d.id}
                        className={`flex-none rounded-full px-2.5 py-1 text-[11px] whitespace-nowrap disabled:opacity-50 ${
                          d.plan_b_active
                            ? "border border-input-border bg-card text-ink hover:border-ink"
                            : "bg-ink text-cream hover:bg-accent"
                        }`}
                      >
                        {planBPending === d.id ? "…" : d.plan_b_active ? "Back to A" : "Switch"}
                      </button>
                    </div>
                  ) : (
                    on && (
                      <button
                        onClick={() => {
                          setPlanBEditing(d.id);
                          setPlanBWhen("");
                          setPlanBText("");
                        }}
                        className="mt-2.5 block w-full border-t border-dashed border-[#DDD6C8] pt-2 text-left text-[12px] text-ink-soft hover:text-accent"
                      >
                        + Add a Plan B for this day
                      </button>
                    )
                  )}
                </div>

                {addingOnDay === d.id ? (
                  <input
                    autoFocus
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addItem(d.id);
                      }
                      if (e.key === "Escape") {
                        setAddingOnDay(null);
                        setDraftText("");
                      }
                    }}
                    onBlur={() => addItem(d.id)}
                    disabled={pending}
                    placeholder="What's happening…"
                    className="mt-2 w-full rounded-md border border-input-border bg-card px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-ink"
                  />
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDayId(d.id);
                      setAddingOnDay(d.id);
                      setDraftText("");
                    }}
                    className="mt-1.5 text-[12px] text-faint hover:text-accent"
                  >
                    + add
                  </button>
                )}
              </div>
            );
          })}
          {railBottom}
        </div>
      </div>
    </div>
  );
}
