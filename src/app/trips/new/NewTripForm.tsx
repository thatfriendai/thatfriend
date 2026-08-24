"use client";

import { useActionState } from "react";
import { createTrip } from "@/app/trips/actions";

export function NewTripForm() {
  const [state, formAction, pending] = useActionState(createTrip, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Trip name
        <input
          type="text"
          name="name"
          required
          placeholder="Tahoe cabin weekend"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Rough dates
        <input
          type="text"
          name="target_dates"
          placeholder="Early October, 3-4 days"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create trip"}
      </button>
    </form>
  );
}
