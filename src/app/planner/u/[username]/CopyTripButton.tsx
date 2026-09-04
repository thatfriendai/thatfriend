"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CopyTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/copy`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      if (res.status === 401) {
        router.push("/planner/login");
        return;
      }
      setError(data.error ?? "Could not copy this trip.");
      return;
    }
    router.push(`/planner/trips/${data.tripId}`);
  }

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={copy}
        disabled={pending}
        className="rounded-full bg-ink px-4.5 py-2 text-[12.5px] text-cream hover:bg-accent disabled:opacity-50"
      >
        {pending ? "Copying…" : "Copy into a new trip"}
      </button>
      {error && <span className="text-[12px] text-red-700">{error}</span>}
    </div>
  );
}
