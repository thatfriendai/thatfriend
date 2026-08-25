"use client";

import { useActionState } from "react";
import { createTrip } from "@/app/trips/actions";

export function NewTripForm({ defaultName }: { defaultName?: string }) {
  const [state, formAction, pending] = useActionState(createTrip, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm text-ink/80">
        Trip name
        <input
          type="text"
          name="name"
          required
          defaultValue={defaultName}
          placeholder="Tahoe cabin weekend"
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-ink focus:border-accent focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-ink/80">
        Rough dates
        <input
          type="text"
          name="target_dates"
          placeholder="Early October, 3-4 days"
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-ink focus:border-accent focus:outline-none"
        />
      </label>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create trip"}
      </button>
    </form>
  );
}
