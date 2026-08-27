"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewTripForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch("/api/v2/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, destination }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Could not create trip.");
      setPending(false);
      return;
    }

    router.push(`/planner/trips/${data.trip.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm text-ink/80">
        Trip name
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lisbon & the Algarve"
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-ink focus:border-accent focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-ink/80">
        Destination
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-ink focus:border-accent focus:outline-none"
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
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
