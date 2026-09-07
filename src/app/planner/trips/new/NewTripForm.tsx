"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AvailabilityCalendar } from "@/components/planner/AvailabilityCalendar";
import { CopyInviteLink } from "@/app/planner/trips/[id]/CopyInviteLink";

const OCCASIONS = [
  "Bachelorette",
  "Reunion",
  "Birthday",
  "Remote work week",
  "Family",
  "Just a trip",
];

const BANDS = [
  { key: "Tight", hint: "Hostels, buses" },
  { key: "Middle", hint: "Airbnb, some dinners" },
  { key: "Comfortable", hint: "Hotels, no counting" },
  { key: "Mixed", hint: "People differ a lot" },
];

const PRIVACY_OPTIONS = [
  {
    key: "private" as const,
    label: "Private",
    hint: "Answers stay sealed. Everyone sees the overlap, nobody sees who said what.",
  },
  {
    key: "open" as const,
    label: "Open",
    hint: "Everyone sees each other's numbers and notes as they come in.",
  },
];

function chipClass(on: boolean) {
  return on
    ? "rounded-full border border-ink bg-ink px-4 py-2.5 text-sm text-cream"
    : "rounded-full border border-input-border bg-card px-4 py-2.5 text-sm text-body hover:border-ink";
}

function cardClass(on: boolean) {
  return `min-w-[130px] flex-1 rounded-xl border px-4 py-3.5 text-left transition-colors ${
    on ? "border-ink bg-card shadow-[0_1px_0_#1B1917]" : "border-input-border bg-transparent"
  }`;
}

export function NewTripForm({ defaultName }: { defaultName?: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName ?? "");
  const [destination, setDestination] = useState("");
  const [undecidedDestination, setUndecidedDestination] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [occasion, setOccasion] = useState<string | null>(null);
  const [band, setBand] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<"private" | "open">("private");
  const [invitees, setInvitees] = useState<string[]>([]);
  const [newInvitee, setNewInvitee] = useState("");
  const [pending, setPending] = useState<"invite" | "later" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; joinToken: string; finishLater: boolean } | null>(null);

  function addInvitee() {
    const v = newInvitee.trim();
    if (!v || invitees.includes(v)) return;
    setInvitees((list) => [...list, v]);
    setNewInvitee("");
  }

  async function handleSubmit(e: React.SyntheticEvent, finishLater = false) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(finishLater ? "later" : "invite");
    setError(null);

    const res = await fetch("/api/v2/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        destination: undecidedDestination ? "" : destination,
        available_dates: availableDates,
        occasion,
        budget_band: band,
        privacy,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Could not create trip.");
      setPending(null);
      return;
    }

    if (!finishLater && invitees.length > 0) {
      await fetch(`/api/v2/trips/${data.trip.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          invitees.map((v) => (v.includes("@") ? { email: v } : { phone: v }))
        ),
      });
    }

    setPending(null);
    setCreated({ id: data.trip.id, joinToken: data.joinToken, finishLater });
  }

  if (created) {
    return (
      <div className="flex flex-col gap-7">
        <div>
          <p className="mb-1.5 text-2xl font-display text-ink">Trip created.</p>
          <p className="text-[15px] text-body">
            Send this to the group, or skip straight in.
          </p>
        </div>
        <CopyInviteLink
          url={`${typeof window !== "undefined" ? window.location.origin : ""}/planner/join/${created.joinToken}`}
        />
        <button
          type="button"
          onClick={() =>
            router.push(
              created.finishLater
                ? `/planner/trips/${created.id}`
                : `/planner/trips/${created.id}/preferences`
            )
          }
          className="self-start rounded-full bg-ink px-7.5 py-3.5 text-[15.5px] text-cream hover:bg-accent"
        >
          {created.finishLater ? "Go to the trip" : "Continue to your preferences"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-9">
      <div>
        <label className="mb-2.5 block text-base font-medium text-ink">
          Trip name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Lisbon before it gets cold"
          className="w-full rounded-xl border border-input-border bg-card px-4.5 py-3.5 text-base text-ink outline-none focus:border-ink"
        />
      </div>

      <div>
        <div className="mb-2.5 flex items-baseline justify-between">
          <label className="text-base font-medium text-ink">Where</label>
          <button
            type="button"
            onClick={() => setUndecidedDestination((v) => !v)}
            className={
              undecidedDestination
                ? "font-mono text-xs text-ink"
                : "font-mono text-xs text-muted hover:text-ink"
            }
          >
            {undecidedDestination ? "Actually, I know" : "We haven't decided"}
          </button>
        </div>
        {!undecidedDestination && (
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Lisbon, Portugal"
            className="w-full rounded-xl border border-input-border bg-card px-4.5 py-3.5 text-base text-ink outline-none focus:border-ink"
          />
        )}
        <p className="mt-2.5 text-[13.5px] text-muted">
          {undecidedDestination
            ? "That Friend can suggest a few once everyone's answered."
            : "You can change this later."}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-base font-medium text-ink">When</label>
        <p className="mb-3 text-sm text-muted">
          Mark every day that could work. Everyone you invite marks theirs
          on top of yours, and the dates lock themselves once a stretch
          works for all of you.
        </p>
        <AvailabilityCalendar value={availableDates} onChange={setAvailableDates} />
        {availableDates.length > 0 && (
          <p className="mt-2.5 text-[13px] text-muted">
            {availableDates.length} day{availableDates.length === 1 ? "" : "s"} marked
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-base font-medium text-ink">What is it</label>
        <p className="mb-3 text-sm text-muted">
          Shapes what That Friend suggests and who it nudges.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {OCCASIONS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOccasion(o)}
              className={chipClass(occasion === o)}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-base font-medium text-ink">
          Rough budget band
        </label>
        <p className="mb-3 text-sm text-muted">
          A starting point. Everyone sets their own numbers on the next
          screen.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {BANDS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBand(b.key)}
              className={cardClass(band === b.key)}
            >
              <div className="text-[14.5px] font-medium text-ink">{b.key}</div>
              <div className="mt-1 text-xs text-muted">{b.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-base font-medium text-ink">
          Who sees the answers
        </label>
        <p className="mb-3 text-sm text-muted">
          Your call, and it holds for everyone on this trip.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {PRIVACY_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setPrivacy(o.key)}
              className={cardClass(privacy === o.key)}
            >
              <div className="text-[14.5px] font-medium text-ink">{o.label}</div>
              <div className="mt-1.5 text-xs leading-relaxed text-muted">{o.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-base font-medium text-ink">
          Who&rsquo;s coming
        </label>
        <p className="mb-3 text-sm text-muted">
          They get a link. They&rsquo;ll sign in or create an account the
          first time they open it.
        </p>
        {invitees.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {invitees.map((v) => (
              <div
                key={v}
                className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pr-1.5 pl-3 text-sm"
              >
                <span>{v}</span>
                <button
                  type="button"
                  onClick={() =>
                    setInvitees((list) => list.filter((x) => x !== v))
                  }
                  className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-border-soft text-[11px] text-muted"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2.5">
          <input
            value={newInvitee}
            onChange={(e) => setNewInvitee(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addInvitee();
              }
            }}
            placeholder="friend@email.com or +351 912 345 678"
            className="flex-1 rounded-xl border border-input-border bg-card px-4.5 py-3.5 text-base text-ink outline-none focus:border-ink"
          />
          <button
            type="button"
            onClick={addInvitee}
            className="rounded-xl border border-input-border bg-card px-5.5 py-3.5 text-sm text-ink hover:border-ink"
          >
            Add
          </button>
        </div>
        <p className="mt-2.5 text-[13.5px] text-muted">
          Email gets a link. A number gets it on WhatsApp, and turns on the
          bot for them.
        </p>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-4.5 border-t border-border pt-7">
        <button
          type="submit"
          disabled={pending !== null}
          className="rounded-full bg-ink px-7.5 py-3.5 text-[15.5px] text-cream hover:bg-accent disabled:opacity-50"
        >
          {pending === "invite" ? "Creating…" : "Create trip and invite"}
        </button>
        <button
          type="button"
          onClick={(e) => handleSubmit(e, true)}
          disabled={pending !== null}
          className="rounded-full border border-input-border bg-card px-6 py-3.5 text-[15px] text-ink hover:border-ink disabled:opacity-50"
        >
          {pending === "later" ? "Saving…" : "Save and finish later"}
        </button>
        <span className="text-sm text-muted">
          {invitees.length > 0
            ? `${invitees.length} invite${invitees.length === 1 ? "" : "s"} go out now, and everyone gets asked for their budget.`
            : "You can add or remove people anytime."}
        </span>
      </div>
    </form>
  );
}
