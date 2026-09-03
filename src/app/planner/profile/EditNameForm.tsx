"use client";

import { useState, useTransition } from "react";
import { updateName } from "./actions";

export function EditNameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateName(name);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-[15.5px] text-ink">{initialName || "No name set"}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[13.5px] text-muted hover:text-accent"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        className="rounded-full border border-input-border bg-card px-4 py-2 text-[15px] text-ink outline-none focus:border-ink"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-ink px-4 py-2 text-[13.5px] text-cream hover:bg-accent disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setName(initialName);
          setError(null);
        }}
        className="text-[13.5px] text-muted hover:text-ink"
      >
        Cancel
      </button>
      {error && <span className="text-[13px] text-red-700">{error}</span>}
    </form>
  );
}
