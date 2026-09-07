"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BUDGET_FIELDS, PACE_OPTIONS, INTERESTS } from "@/lib/planner/preferences";
import { AvailabilityCalendar } from "@/components/planner/AvailabilityCalendar";
import type { Pace, PlannerPreference } from "@/lib/supabase/planner-types";

export function PreferencesForm({
  tripId,
  initial,
  isPrivate,
  datesLocked,
  initialAvailableDates,
}: {
  tripId: string;
  initial: PlannerPreference | null;
  isPrivate: boolean;
  datesLocked: boolean;
  initialAvailableDates: string[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>({
    stay_max: initial?.stay_max ?? BUDGET_FIELDS[0].default,
    flight_max: initial?.flight_max ?? BUDGET_FIELDS[1].default,
    food_max: initial?.food_max ?? BUDGET_FIELDS[2].default,
  });
  const [pace, setPace] = useState<Pace>(initial?.pace ?? "Balanced");
  const [interests, setInterests] = useState<string[]>(initial?.interests ?? []);
  const [nonNegotiable, setNonNegotiable] = useState(initial?.non_negotiable ?? "");
  const [availableDates, setAvailableDates] = useState<string[]>(initialAvailableDates);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleInterest(label: string) {
    setInterests((list) => {
      if (list.includes(label)) return list.filter((l) => l !== label);
      if (list.length >= 3) return list;
      return [...list, label];
    });
  }

  const estimate = values.stay_max * 7 + values.flight_max + values.food_max * 7;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch(`/api/v2/trips/${tripId}/preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        pace,
        interests,
        non_negotiable: nonNegotiable,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save your preferences.");
      setPending(false);
      return;
    }

    if (!datesLocked) {
      await fetch(`/api/v2/trips/${tripId}/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: availableDates }),
      });
    }

    router.push(`/planner/trips/${tripId}/convergence`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      {!datesLocked && (
        <div>
          <label className="mb-1 block text-base font-medium text-ink">
            When you can go
          </label>
          <p className="mb-3.5 text-sm text-muted">
            Every day that could work, not just your ideal week. The group
            sees the overlap, not your calendar.
          </p>
          <AvailabilityCalendar value={availableDates} onChange={setAvailableDates} />
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-base font-medium text-ink">
          What you can spend
        </label>
        <p className="mb-5.5 text-sm text-muted">
          {isPrivate
            ? "Three numbers instead of one total. Nobody knows the whole cost until the end."
            : "Three numbers instead of one total. Everyone can see these as you go."}
        </p>
        <div className="flex flex-col gap-6.5">
          {BUDGET_FIELDS.map((field) => (
            <div key={field.key}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[15px] text-ink">{field.label}</span>
                <span className="font-mono text-[17px] text-accent">
                  ${values[field.key]}
                </span>
              </div>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={values[field.key]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.key]: Number(e.target.value) }))
                }
                className="h-1 w-full accent-accent"
              />
              <div className="mt-2 flex justify-between font-mono text-[11px] text-faint">
                <span>${field.min}</span>
                <span>{field.unit}</span>
                <span>${field.max}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5.5 flex items-baseline justify-between rounded-xl border border-border-soft bg-card p-4">
          <span className="text-sm text-body">Rough week, at these numbers</span>
          <span className="font-mono text-[17px] text-ink">${estimate}</span>
        </div>
      </div>

      <div>
        <label className="mb-3.5 block text-base font-medium text-ink">
          Pace of the days
        </label>
        <div className="flex gap-2.5">
          {PACE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPace(opt.key)}
              className={`flex-1 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                pace === opt.key
                  ? "border-ink bg-card shadow-[0_1px_0_#1B1917]"
                  : "border-input-border bg-transparent"
              }`}
            >
              <div className="text-[14.5px] font-medium text-ink">{opt.key}</div>
              <div className="mt-1 text-xs text-muted">{opt.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-base font-medium text-ink">
          What you&rsquo;d hate to miss
        </label>
        <p className="mb-3.5 text-sm text-muted">
          Pick up to three. These become candidate stops on the map.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {INTERESTS.map((label) => {
            const on = interests.includes(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleInterest(label)}
                className={`rounded-full border px-4 py-2.5 text-sm transition-colors ${
                  on
                    ? "border-accent bg-accent text-cream"
                    : "border-input-border bg-card text-ink-body hover:border-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-base font-medium text-ink">
          One non-negotiable
        </label>
        <p className="mb-3.5 text-sm text-muted">
          The thing that quietly ruins the trip if it&rsquo;s ignored.
        </p>
        <textarea
          value={nonNegotiable}
          onChange={(e) => setNonNegotiable(e.target.value)}
          placeholder="e.g. no shared rooms, I'll pay the difference for a single"
          rows={3}
          className="w-full resize-y rounded-xl border border-input-border bg-card px-4.5 py-3.5 text-[15.5px] text-ink outline-none focus:border-ink"
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex items-center gap-4.5 border-t border-border pt-7">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-7.5 py-3.5 text-[15.5px] text-cream hover:bg-accent disabled:opacity-50"
        >
          {pending ? "Saving…" : initial ? "Update my preferences" : "Add my preferences"}
        </button>
        <span className="text-sm text-muted">
          You can change your answers anytime.
        </span>
      </div>
    </form>
  );
}
