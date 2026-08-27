"use client";

import { useRef, useState } from "react";
import { KIND_OPTIONS, formatDayLabel } from "@/lib/planner/itinerary";
import type { PlaceKind, PlannerDay, PlannerPlace } from "@/lib/supabase/planner-types";

type Step = "source" | "manual" | "link" | "text" | "screenshot" | "review";

interface Candidate {
  name: string;
  kind: PlaceKind;
  note: string;
  include: boolean;
  day_id: string;
}

const SOURCES: { key: Step; label: string; hint: string }[] = [
  { key: "link", label: "Paste a link", hint: "An article, a blog post, a Maps share link" },
  { key: "text", label: "Paste text", hint: "A forwarded message, a caption, a list" },
  { key: "screenshot", label: "Upload a screenshot", hint: "We'll read the names out of it" },
  { key: "manual", label: "Type it in", hint: "Quick manual entry, no extraction" },
];

export function AddPlaceModal({
  tripId,
  days,
  open,
  onClose,
  onCreated,
}: {
  tripId: string;
  days: PlannerDay[];
  open: boolean;
  onClose: () => void;
  onCreated: (place: PlannerPlace & { sourceLabel: string | null }) => void;
}) {
  const [step, setStep] = useState<Step>("source");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // manual entry
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PlaceKind>("Restaurants");
  const [note, setNote] = useState("");
  const [dayId, setDayId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // extraction
  const [linkUrl, setLinkUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [image, setImage] = useState<{ base64: string; mediaType: string; fileName: string } | null>(
    null
  );
  const [extracting, setExtracting] = useState(false);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [resourceLabel, setResourceLabel] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  function reset() {
    setStep("source");
    setName("");
    setKind("Restaurants");
    setNote("");
    setDayId("");
    setError(null);
    setLinkUrl("");
    setPastedText("");
    setImage(null);
    setResourceId(null);
    setResourceLabel(null);
    setCandidates([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);

    const res = await fetch(`/api/v2/trips/${tripId}/places`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind, note, day_id: dayId || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save that place.");
      return;
    }

    onCreated({ ...data.place, sourceLabel: null });
    handleClose();
  }

  async function runExtract(type: "link" | "text" | "screenshot") {
    setExtracting(true);
    setError(null);

    const body =
      type === "link"
        ? { type, url: linkUrl.trim() }
        : type === "text"
          ? { type, text: pastedText.trim() }
          : { type, image: image?.base64, mediaType: image?.mediaType };

    const res = await fetch(`/api/v2/trips/${tripId}/resources/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setExtracting(false);

    if (!res.ok) {
      setError(data.error ?? "Couldn't read that.");
      return;
    }

    setResourceId(data.resource.id);
    setResourceLabel(data.resource.label);
    setCandidates(
      (data.candidates ?? []).map((c: { name: string; kind: PlaceKind; note: string }) => ({
        ...c,
        include: true,
        day_id: "",
      }))
    );
    setStep("review");
  }

  function onFileChosen(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError("That screenshot is too big — try one under 5MB.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      setImage({ base64, mediaType: file.type, fileName: file.name });
    };
    reader.readAsDataURL(file);
  }

  function updateCandidate(i: number, patch: Partial<Candidate>) {
    setCandidates((list) => list.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function confirmCandidates() {
    const chosen = candidates
      .filter((c) => c.include)
      .map((c) => ({ name: c.name, kind: c.kind, note: c.note, day_id: c.day_id || undefined }));
    if (chosen.length === 0 || !resourceId) return;

    setConfirming(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/resources/${resourceId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ places: chosen }),
    });
    const data = await res.json().catch(() => ({}));
    setConfirming(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save these.");
      return;
    }

    (data.places ?? []).forEach((p: PlannerPlace) => onCreated({ ...p, sourceLabel: resourceLabel }));
    handleClose();
  }

  const daySelect = (value: string, onChange: (v: string) => void, className?: string) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "w-full rounded-xl border border-input-border bg-card px-4 py-3 text-[15px] text-ink outline-none focus:border-ink"
      }
    >
      <option value="">No day yet</option>
      {days.map((d) => (
        <option key={d.id} value={d.id}>
          {formatDayLabel(d.date)}
          {d.city ? ` · ${d.city}` : ""}
        </option>
      ))}
    </select>
  );

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(27,25,23,0.35)] px-6"
      onClick={handleClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-2xl border border-border bg-cream"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6.5 py-5">
          <div className="font-display text-[23px] text-ink">Add a place</div>
          <button
            onClick={handleClose}
            className="text-xl leading-none text-muted hover:text-ink"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {step === "source" && (
          <div className="grid grid-cols-2 gap-2.5 px-6.5 py-6.5">
            {SOURCES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStep(s.key)}
                className="rounded-xl border border-input-border bg-card px-4 py-4 text-left transition-colors hover:border-ink"
              >
                <div className="text-[14.5px] font-medium text-ink">{s.label}</div>
                <div className="mt-1 text-[12.5px] leading-[1.45] text-muted">{s.hint}</div>
              </button>
            ))}
          </div>
        )}

        {step === "link" && (
          <div className="flex flex-col gap-4.5 px-6.5 py-6">
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://"
              autoFocus
              className="w-full rounded-xl border border-input-border bg-card px-4.5 py-3.5 text-[15.5px] text-ink outline-none focus:border-ink"
            />
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => runExtract("link")}
                disabled={!linkUrl.trim() || extracting}
                className="rounded-full bg-ink px-6.5 py-3 text-[15px] text-cream hover:bg-accent disabled:opacity-50"
              >
                {extracting ? "Reading…" : "Find places"}
              </button>
              <button type="button" onClick={() => setStep("source")} className="text-sm text-muted hover:text-ink">
                Back
              </button>
            </div>
          </div>
        )}

        {step === "text" && (
          <div className="flex flex-col gap-4.5 px-6.5 py-6">
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={6}
              autoFocus
              placeholder="Paste a forwarded message, a caption, a list of names…"
              className="w-full resize-y rounded-xl border border-input-border bg-card px-4.5 py-3.5 text-[15px] text-ink outline-none focus:border-ink"
            />
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => runExtract("text")}
                disabled={!pastedText.trim() || extracting}
                className="rounded-full bg-ink px-6.5 py-3 text-[15px] text-cream hover:bg-accent disabled:opacity-50"
              >
                {extracting ? "Reading…" : "Find places"}
              </button>
              <button type="button" onClick={() => setStep("source")} className="text-sm text-muted hover:text-ink">
                Back
              </button>
            </div>
          </div>
        )}

        {step === "screenshot" && (
          <div className="flex flex-col gap-4.5 px-6.5 py-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileChosen(file);
              }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl border border-dashed border-input-border bg-card px-5 py-8.5 text-center hover:border-ink"
            >
              {image ? (
                <div className="text-[15px] text-ink">{image.fileName}</div>
              ) : (
                <>
                  <div className="text-[15px] text-ink">Drop a screenshot here</div>
                  <div className="mt-1.5 text-[13px] text-muted">Or click to choose a file</div>
                </>
              )}
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => runExtract("screenshot")}
                disabled={!image || extracting}
                className="rounded-full bg-ink px-6.5 py-3 text-[15px] text-cream hover:bg-accent disabled:opacity-50"
              >
                {extracting ? "Reading…" : "Find places"}
              </button>
              <button type="button" onClick={() => setStep("source")} className="text-sm text-muted hover:text-ink">
                Back
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="px-6.5 py-6">
            <div className="mb-1 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
              {candidates.length > 0
                ? `Found ${candidates.length} place${candidates.length === 1 ? "" : "s"}`
                : "Nothing found"}
            </div>
            {candidates.length === 0 && (
              <p className="mt-3 text-sm text-body">
                Couldn&rsquo;t pull any named places out of that. Try a different source, or type it
                in.
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2.5">
              {candidates.map((c, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-xl border px-4 py-3.5"
                  style={{ borderColor: c.include ? "#DDD6C8" : "#EDE8DD" }}
                >
                  <button
                    type="button"
                    onClick={() => updateCandidate(i, { include: !c.include })}
                    className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border text-[12px]"
                    style={{
                      borderColor: c.include ? "#1B1917" : "#DDD6C8",
                      background: c.include ? "#1B1917" : "transparent",
                      color: "#FFFDF9",
                    }}
                  >
                    {c.include ? "✓" : ""}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium text-[#2B2825]">{c.name}</div>
                    {c.note && (
                      <div className="mt-0.5 text-[13px] leading-[1.45] text-muted">{c.note}</div>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <select
                        value={c.kind}
                        onChange={(e) => updateCandidate(i, { kind: e.target.value as PlaceKind })}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] text-ink-soft"
                      >
                        {KIND_OPTIONS.map((k) => (
                          <option key={k.kind} value={k.kind}>
                            {k.kind}
                          </option>
                        ))}
                      </select>
                      {daySelect(
                        c.day_id,
                        (v) => updateCandidate(i, { day_id: v }),
                        "rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] text-ink-soft"
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

            <div className="mt-5.5 flex items-center gap-4 border-t border-border pt-5">
              {candidates.length > 0 ? (
                <button
                  type="button"
                  onClick={confirmCandidates}
                  disabled={confirming || candidates.every((c) => !c.include)}
                  className="rounded-full bg-ink px-6.5 py-3 text-[15px] text-cream hover:bg-accent disabled:opacity-50"
                >
                  {confirming ? "Saving…" : "Add to the doc"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep("manual")}
                  className="rounded-full bg-ink px-6.5 py-3 text-[15px] text-cream hover:bg-accent"
                >
                  Type it in instead
                </button>
              )}
              <button type="button" onClick={() => setStep("source")} className="text-sm text-muted hover:text-ink">
                Start over
              </button>
            </div>
          </div>
        )}

        {step === "manual" && (
          <form onSubmit={handleManualSubmit} className="flex flex-col gap-4.5 px-6.5 py-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="Ramiro"
                className="w-full rounded-xl border border-input-border bg-card px-4 py-3 text-[15px] text-ink outline-none focus:border-ink"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Kind</label>
              <div className="flex flex-wrap gap-2">
                {KIND_OPTIONS.map((k) => (
                  <button
                    key={k.kind}
                    type="button"
                    onClick={() => setKind(k.kind)}
                    className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
                      kind === k.kind
                        ? "border-transparent text-cream"
                        : "border-input-border bg-card text-ink-soft hover:border-ink"
                    }`}
                    style={kind === k.kind ? { background: k.color } : undefined}
                  >
                    {k.kind}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Day <span className="text-muted">(optional)</span>
              </label>
              {daySelect(dayId, setDayId)}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Note <span className="text-muted">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Book two weeks out."
                className="w-full resize-y rounded-xl border border-input-border bg-card px-4 py-3 text-[15px] text-ink outline-none focus:border-ink"
              />
            </div>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <div className="mt-1 flex items-center gap-4">
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-ink px-6.5 py-3 text-[15px] text-cream hover:bg-accent disabled:opacity-50"
              >
                {pending ? "Saving…" : "Add to the doc"}
              </button>
              <button type="button" onClick={() => setStep("source")} className="text-sm text-muted hover:text-ink">
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
