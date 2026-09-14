"use client";

import { useState } from "react";

type Kind = "link" | "text";

export function AddResourceModal({
  tripId,
  open,
  onClose,
  onCreated,
}: {
  tripId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [kind, setKind] = useState<Kind>("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setKind("link");
    setUrl("");
    setText("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "link" && !url.trim()) return;
    if (kind === "text" && !text.trim()) return;

    setPending(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kind === "link" ? { type: "link", url: url.trim() } : { type: "text", text: text.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save that.");
      return;
    }

    onCreated();
    handleClose();
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(27,25,23,0.35)] px-6"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl border border-border bg-cream"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6.5 py-5">
          <div className="font-display text-[23px] text-ink">Add a resource</div>
          <button onClick={handleClose} className="text-xl leading-none text-muted hover:text-ink" aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4.5 px-6.5 py-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind("link")}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] ${kind === "link" ? "border-ink bg-ink text-cream" : "border-input-border bg-card text-ink-body"}`}
            >
              A link
            </button>
            <button
              type="button"
              onClick={() => setKind("text")}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] ${kind === "text" ? "border-ink bg-ink text-cream" : "border-input-border bg-card text-ink-body"}`}
            >
              A note
            </button>
          </div>

          {kind === "link" ? (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/… or an article link"
              autoFocus
              className="w-full rounded-xl border border-input-border bg-card px-4.5 py-3.5 text-[15.5px] text-ink outline-none focus:border-ink"
            />
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Anything worth keeping around for the group — a packing note, a tip someone sent."
              className="w-full resize-y rounded-xl border border-input-border bg-card px-4.5 py-3.5 text-[15px] text-ink outline-none focus:border-ink"
            />
          )}

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="mt-1 flex items-center gap-4">
            <button
              type="submit"
              disabled={pending || (kind === "link" ? !url.trim() : !text.trim())}
              className="rounded-full bg-ink px-6.5 py-3 text-[15px] text-cream hover:bg-accent disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save it"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
