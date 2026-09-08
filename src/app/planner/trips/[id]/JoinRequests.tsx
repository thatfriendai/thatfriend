"use client";

import { useState } from "react";

interface Request {
  id: string;
  label: string;
}

export function JoinRequests({ tripId, initial }: { tripId: string; initial: Request[] }) {
  const [requests, setRequests] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function respond(requestId: string, status: "accepted" | "declined") {
    setPendingId(requestId);
    const res = await fetch(`/api/v2/trips/${tripId}/join-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setPendingId(null);
    if (!res.ok) return;
    setRequests((list) => list.filter((r) => r.id !== requestId));
  }

  if (requests.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {requests.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-warm-border bg-warm-bg px-4 py-3"
        >
          <span className="text-[14px] text-ink-body">{r.label} asked to join this trip</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => respond(r.id, "accepted")}
              disabled={pendingId === r.id}
              className="rounded-full bg-ink px-3.5 py-1.5 text-[12.5px] text-cream hover:bg-accent disabled:opacity-50"
            >
              Accept
            </button>
            <button
              onClick={() => respond(r.id, "declined")}
              disabled={pendingId === r.id}
              className="rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[12.5px] text-ink hover:border-ink disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
