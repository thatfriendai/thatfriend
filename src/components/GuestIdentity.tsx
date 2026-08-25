"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useLocalStorageItem, setLocalStorageItem } from "@/lib/local-storage-store";

interface GuestIdentityContextValue {
  name: string;
  participantId: string | null;
  setParticipantId: (id: string) => void;
}

const GuestIdentityContext = createContext<GuestIdentityContextValue | null>(
  null
);

export function useGuestIdentity() {
  const ctx = useContext(GuestIdentityContext);
  if (!ctx) {
    throw new Error("useGuestIdentity must be used within GuestIdentityProvider");
  }
  return ctx;
}

function storageKey(tripId: string, field: "name" | "participantId") {
  return `tf:${tripId}:${field}`;
}

export function GuestIdentityProvider({
  tripId,
  children,
}: {
  tripId: string;
  children: ReactNode;
}) {
  const name = useLocalStorageItem(storageKey(tripId, "name")) ?? "";
  const participantId = useLocalStorageItem(storageKey(tripId, "participantId"));
  const [draftName, setDraftName] = useState("");

  function setParticipantId(id: string) {
    setLocalStorageItem(storageKey(tripId, "participantId"), id);
  }

  function saveName(newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setLocalStorageItem(storageKey(tripId, "name"), trimmed);
  }

  if (!name) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveName(draftName);
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1.5 text-sm text-ink/80">
            What&apos;s your name?
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              required
              placeholder="So we know who added what"
              className="rounded-xl border border-border bg-cream px-4 py-2.5 text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink"
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <GuestIdentityContext.Provider
      value={{ name, participantId, setParticipantId }}
    >
      {children}
    </GuestIdentityContext.Provider>
  );
}
