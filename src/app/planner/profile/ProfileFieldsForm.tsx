"use client";

import { useState, useTransition } from "react";

export function ProfileFieldsForm({
  initialUsername,
  initialTagline,
}: {
  initialUsername: string;
  initialTagline: string;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [tagline, setTagline] = useState(initialTagline);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState({ username: initialUsername, tagline: initialTagline });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/v2/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tagline }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      setSaved({ username: data.user.username ?? "", tagline: data.user.tagline ?? "" });
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-[15.5px] text-ink">
            {saved.username ? `@${saved.username}` : "No username set"}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[13.5px] text-muted hover:text-accent"
          >
            Edit
          </button>
        </div>
        {saved.tagline && <span className="text-[13.5px] text-body">{saved.tagline}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[15px] text-muted">@</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoFocus
          placeholder="username"
          className="rounded-full border border-input-border bg-card px-4 py-2 text-[15px] text-ink outline-none focus:border-ink"
        />
      </div>
      <input
        value={tagline}
        onChange={(e) => setTagline(e.target.value)}
        placeholder="A short line about you (shown on your profile)"
        className="w-full rounded-full border border-input-border bg-card px-4 py-2 text-[14.5px] text-ink outline-none focus:border-ink"
      />
      <div className="flex items-center gap-2.5">
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
            setUsername(saved.username);
            setTagline(saved.tagline);
            setError(null);
          }}
          className="text-[13.5px] text-muted hover:text-ink"
        >
          Cancel
        </button>
        {error && <span className="text-[13px] text-red-700">{error}</span>}
      </div>
    </form>
  );
}
