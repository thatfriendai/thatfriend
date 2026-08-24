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
      <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveName(draftName);
          }}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1 text-sm">
            What&apos;s your name?
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              required
              placeholder="So we know who added what"
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
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
