"use client";

import { useState } from "react";

export function AskToJoinButton({ tripId }: { tripId: string }) {
  const [state, setState] = useState<"idle" | "pending" | "sent" | "error">("idle");

  async function ask() {
    setState("pending");
    const res = await fetch(`/api/v2/trips/${tripId}/join-requests`, { method: "POST" });
    setState(res.ok ? "sent" : "error");
  }

  if (state === "sent") {
    return <span className="text-[13px] text-muted">Request sent</span>;
  }

  return (
    <button
      type="button"
      onClick={ask}
      disabled={state === "pending"}
      className="whitespace-nowrap rounded-full border border-input-border bg-card px-4 py-2 text-[13px] text-ink hover:border-ink disabled:opacity-50"
    >
      {state === "pending" ? "Asking…" : state === "error" ? "Try again" : "Ask to join"}
    </button>
  );
}
