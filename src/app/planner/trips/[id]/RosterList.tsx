"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { initialsOf } from "@/lib/planner/initials";

interface Member {
  userId: string;
  label: string;
  role: "owner" | "member";
}

export function RosterList({
  tripId,
  initial,
  myUserId,
  avatarColors,
}: {
  tripId: string;
  initial: Member[];
  myUserId: string;
  avatarColors: readonly string[];
}) {
  const router = useRouter();
  const [roster, setRoster] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferTo, setTransferTo] = useState("");

  const isOwner = roster.find((m) => m.userId === myUserId)?.role === "owner";
  const others = roster.filter((m) => m.userId !== myUserId);
  // Alone on the trip, the organizer can leave too — which deletes it.
  const isSoloOwner = isOwner && others.length === 0;

  async function leave() {
    const message = isSoloOwner
      ? "Delete this trip? You're the only one on it, so leaving deletes it and everything in it — dates, places, votes. This can't be undone."
      : "Leave this trip? You'll stop getting texts about it, and can be re-invited later.";
    if (!window.confirm(message)) return;
    setPendingId(myUserId);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/leave`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPendingId(null);
    if (!res.ok) {
      setError(data.error ?? "Couldn't leave the trip.");
      return;
    }
    router.push("/planner/trips");
  }

  async function remove(userId: string, label: string) {
    if (!window.confirm(`Remove ${label} from this trip? They'll stop getting texts about it immediately.`)) return;
    setPendingId(userId);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/members/${userId}/remove`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPendingId(null);
    if (!res.ok) {
      setError(data.error ?? "Couldn't remove them.");
      return;
    }
    setRoster((list) => list.filter((m) => m.userId !== userId));
  }

  async function transfer() {
    if (!transferTo) return;
    setPendingId("transfer");
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/transfer-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: transferTo }),
    });
    const data = await res.json().catch(() => ({}));
    setPendingId(null);
    if (!res.ok) {
      setError(data.error ?? "Couldn't transfer the trip.");
      return;
    }
    setRoster((list) =>
      list.map((m) => (m.userId === transferTo ? { ...m, role: "owner" } : m.userId === myUserId ? { ...m, role: "member" } : m))
    );
    setTransferring(false);
    setTransferTo("");
  }


  return (
    <div className="flex flex-col gap-2">
      {roster.map((m, i) => (
        <div key={m.userId} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] text-cream"
            style={{ background: avatarColors[i % avatarColors.length] }}
          >
            {initialsOf(m.label)}
          </div>
          <span className="text-[15px] text-ink-body">{m.label}</span>
          <span className="ml-auto font-mono text-[11px] tracking-[0.08em] text-muted uppercase">{m.role}</span>
          {m.userId === myUserId && (m.role !== "owner" || isSoloOwner) && (
            <button
              type="button"
              onClick={leave}
              disabled={pendingId === myUserId}
              className="text-[12.5px] text-muted hover:text-red-700 disabled:opacity-50"
            >
              {isSoloOwner ? "Leave (deletes trip)" : "Leave"}
            </button>
          )}
          {isOwner && m.userId !== myUserId && (
            <button
              type="button"
              onClick={() => remove(m.userId, m.label)}
              disabled={pendingId === m.userId}
              className="text-[12.5px] text-muted hover:text-red-700 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      ))}

      {isOwner && others.length > 0 && (
        <div className="mt-1">
          {!transferring ? (
            <button
              type="button"
              onClick={() => setTransferring(true)}
              className="text-[12.5px] text-muted underline hover:text-ink"
            >
              Transfer organizer to someone else
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-input-border p-3">
              <select
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                className="flex-1 rounded-lg border border-input-border bg-cream px-3 py-2 text-[13.5px] text-ink"
              >
                <option value="">Choose someone…</option>
                {others.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={transfer}
                disabled={!transferTo || pendingId === "transfer"}
                className="rounded-full bg-ink px-3.5 py-1.5 text-[12.5px] text-cream hover:bg-accent disabled:opacity-50"
              >
                Transfer
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransferring(false);
                  setTransferTo("");
                }}
                className="text-[12.5px] text-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
