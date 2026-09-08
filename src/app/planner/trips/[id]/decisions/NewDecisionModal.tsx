"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface OptionDraft {
  label: string;
  sub: string;
  cost: string;
  fors: string;
  against: string;
}

function blankOption(): OptionDraft {
  return { label: "", sub: "", cost: "", fors: "", against: "" };
}

export function NewDecisionModal({
  tripId,
  open,
  onClose,
}: {
  tripId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"general" | "stay">("general");
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [nights, setNights] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>([blankOption(), blankOption()]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setKind("general");
    setTitle("");
    setWhy("");
    setNights("");
    setOptions([blankOption(), blankOption()]);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function updateOption(i: number, patch: Partial<OptionDraft>) {
    setOptions((list) => list.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanOptions = options
      .filter((o) => o.label.trim())
      .map((o) => ({
        label: o.label,
        sub: o.sub || undefined,
        cost: o.cost || undefined,
        fors: o.fors || undefined,
        against: o.against || undefined,
      }));
    if (!title.trim() || (kind === "general" && cleanOptions.length < 2)) {
      setError("A title and at least two options are required.");
      return;
    }

    setPending(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        why,
        kind,
        nights: kind === "stay" && nights.trim() ? Number(nights) : undefined,
        options: kind === "stay" ? [] : cleanOptions,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setError(data.error ?? "Could not start that decision.");
      return;
    }

    router.push(`/planner/trips/${tripId}/decisions/${data.decision.id}`);
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(27,25,23,0.35)] px-6"
      onClick={handleClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-[600px] overflow-y-auto rounded-2xl border border-border bg-cream"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6.5 py-5">
          <div className="font-display text-[23px] text-ink">Start a decision</div>
          <button onClick={handleClose} className="text-xl leading-none text-muted hover:text-ink" aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6.5 py-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">What&rsquo;s the call</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              placeholder="Villa in Lagos or two hotel rooms?"
              className="w-full rounded-xl border border-input-border bg-card px-4 py-3 text-[15px] text-ink outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Why it matters <span className="text-muted">(optional)</span>
            </label>
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              rows={2}
              placeholder="The villa needs a deposit by Friday."
              className="w-full resize-y rounded-xl border border-input-border bg-card px-4 py-3 text-[15px] text-ink outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKind("general")}
                className={`flex-1 rounded-full border py-2.5 text-center text-sm transition-colors ${
                  kind === "general"
                    ? "border-ink bg-ink text-cream"
                    : "border-border bg-card text-muted hover:border-ink"
                }`}
              >
                General decision
              </button>
              <button
                type="button"
                onClick={() => setKind("stay")}
                className={`flex-1 rounded-full border py-2.5 text-center text-sm transition-colors ${
                  kind === "stay"
                    ? "border-ink bg-ink text-cream"
                    : "border-border bg-card text-muted hover:border-ink"
                }`}
              >
                Where to stay
              </button>
            </div>
            {kind === "stay" && (
              <>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  A side-by-side comparison table — paste listing links in
                  once this is created and they get compared automatically.
                </p>
                <div className="mt-3">
                  <label className="mb-1.5 block text-sm font-medium text-ink">
                    Nights <span className="text-muted">(for per-person pricing — can set later)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={nights}
                    onChange={(e) => setNights(e.target.value)}
                    placeholder="4"
                    className="w-24 rounded-lg border border-input-border bg-card px-3.5 py-2.5 text-[14.5px] text-ink outline-none focus:border-ink"
                  />
                </div>
              </>
            )}
          </div>

          {kind === "general" && (
          <div className="flex flex-col gap-4">
            {options.map((o, i) => (
              <div key={i} className="rounded-xl border border-input-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
                    Option {i + 1}
                  </span>
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOptions((list) => list.filter((_, idx) => idx !== i))}
                      className="text-xs text-muted hover:text-ink"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2.5">
                  <input
                    value={o.label}
                    onChange={(e) => updateOption(i, { label: e.target.value })}
                    placeholder="Name"
                    className="w-full rounded-lg border border-input-border bg-cream px-3.5 py-2.5 text-[14.5px] text-ink outline-none focus:border-ink"
                  />
                  <div className="flex gap-2.5">
                    <input
                      value={o.sub}
                      onChange={(e) => updateOption(i, { sub: e.target.value })}
                      placeholder="Detail (optional)"
                      className="flex-1 rounded-lg border border-input-border bg-cream px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-ink"
                    />
                    <input
                      value={o.cost}
                      onChange={(e) => updateOption(i, { cost: e.target.value })}
                      placeholder="Cost (optional)"
                      className="w-32 rounded-lg border border-input-border bg-cream px-3.5 py-2.5 text-[13.5px] text-ink outline-none focus:border-ink"
                    />
                  </div>
                  <textarea
                    value={o.fors}
                    onChange={(e) => updateOption(i, { fors: e.target.value })}
                    rows={2}
                    placeholder={"Reasons for, one per line (optional)"}
                    className="w-full resize-y rounded-lg border border-input-border bg-cream px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-ink"
                  />
                  <textarea
                    value={o.against}
                    onChange={(e) => updateOption(i, { against: e.target.value })}
                    rows={2}
                    placeholder={"Reasons against, one per line (optional)"}
                    className="w-full resize-y rounded-lg border border-input-border bg-cream px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-ink"
                  />
                </div>
              </div>
            ))}
            {options.length < 6 && (
              <button
                type="button"
                onClick={() => setOptions((list) => [...list, blankOption()])}
                className="self-start text-[13.5px] text-body hover:text-accent"
              >
                + add another option
              </button>
            )}
          </div>
          )}

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="mt-1 flex items-center gap-4 border-t border-border pt-5">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-ink px-6.5 py-3 text-[15px] text-cream hover:bg-accent disabled:opacity-50"
            >
              {pending ? "Starting…" : kind === "stay" ? "Create comparison" : "Start the vote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
