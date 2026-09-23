"use client";

import { useState } from "react";
import type { PlannerTripEssential } from "@/lib/supabase/planner-types";

const SUGGESTED = ["Address", "Door code", "Wi-Fi", "Check-in / out", "Host", "Emergency contact"];

type Draft = { id: string | null; stay: string; label: string; value: string; sub: string };
const EMPTY: Draft = { id: null, stay: "", label: "", value: "", sub: "" };

/**
 * Essentials · pinned — address, door code, Wi-Fi, host: the things someone
 * asks for again at midnight. Grouped into tabs by stay on a trip with more
 * than one place; any member can add or edit a field.
 */
export function EssentialsCard({
  tripId,
  shareUrl,
  initial,
}: {
  tripId: string;
  shareUrl: string;
  initial: PlannerTripEssential[];
}) {
  const [fields, setFields] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const stays = [...new Set(fields.map((f) => f.stay ?? ""))];
  const [tab, setTab] = useState(stays[0] ?? "");
  const activeTab = stays.includes(tab) ? tab : (stays[0] ?? "");
  const shown = fields.filter((f) => (f.stay ?? "") === activeTab);

  async function save() {
    if (!draft || !draft.label.trim() || !draft.value.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/v2/trips/${tripId}/essentials`, {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSaving(false);
    if (!res.ok) return;
    const { essential } = await res.json();
    setFields((list) => (draft.id ? list.map((f) => (f.id === essential.id ? essential : f)) : [...list, essential]));
    setTab(essential.stay ?? "");
    setDraft(null);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/v2/trips/${tripId}/essentials`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setFields((list) => list.filter((f) => f.id !== id));
    setDraft(null);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — nothing to do.
    }
  }

  const input =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-[14px] text-ink outline-none focus:border-ink";

  const form = draft && (
    <div className="flex flex-col gap-2.5 border-t border-line px-5 py-4">
      {!draft.id && !draft.label && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED.filter((s) => !shown.some((f) => f.label === s)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setDraft({ ...draft, label: s })}
              className="rounded-full border border-input-border bg-card px-3 py-1 text-[12.5px] text-ink-soft hover:border-ink hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className={input} placeholder="Label — e.g. Door code" value={draft.label} maxLength={60} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        <input className={input} placeholder="Value — e.g. 4417, then the lockbox" value={draft.value} maxLength={200} autoFocus={Boolean(draft.label)} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
        <input className={input} placeholder="Detail (optional) — e.g. Lockbox code 0921" value={draft.sub} maxLength={200} onChange={(e) => setDraft({ ...draft, sub: e.target.value })} />
        <input className={input} placeholder="Which stay (optional) — e.g. Lisbon" value={draft.stay} maxLength={60} onChange={(e) => setDraft({ ...draft, stay: e.target.value })} />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !draft.label.trim() || !draft.value.trim()}
          className="rounded-full bg-ink px-4.5 py-2 text-[13.5px] text-cream hover:bg-accent disabled:opacity-50"
        >
          {saving ? "Saving…" : draft.id ? "Save" : "Pin it"}
        </button>
        <button type="button" onClick={() => setDraft(null)} className="text-[13.5px] text-muted hover:text-ink">
          Cancel
        </button>
        {draft.id && (
          <button type="button" onClick={() => remove(draft.id!)} className="ml-auto text-[13px] text-muted hover:text-red-700">
            Remove
          </button>
        )}
      </div>
    </div>
  );

  if (fields.length === 0) {
    return (
      <div id="essentials" className="mb-12 overflow-hidden rounded-2xl border border-dashed border-input-border">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
          <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6B655C] uppercase">Essentials</span>
          <span className="text-[13.5px] text-ink-soft">
            Pin the address, door code and Wi-Fi here, so nobody has to ask twice.
          </span>
          {!draft && (
            <button
              type="button"
              onClick={() => setDraft({ ...EMPTY })}
              className="ml-auto rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[13px] text-ink hover:border-ink"
            >
              + Add
            </button>
          )}
        </div>
        {form}
      </div>
    );
  }

  return (
    <div id="essentials" className="mb-12 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
        <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6B655C] uppercase">Essentials &middot; pinned</span>
        {stays.length > 1 && (
          <div className="flex gap-1 rounded-full bg-canvas p-[3px]">
            {stays.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTab(s)}
                className={`rounded-full px-3 py-1 text-[12.5px] ${
                  s === activeTab ? "bg-ink text-on-dark" : "text-ink-soft hover:text-ink"
                }`}
              >
                {s || "General"}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[13px] text-ink-soft md:inline">
            The one link to send when someone asks for the door code again
          </span>
          <button
            type="button"
            onClick={copy}
            className="rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[13px] whitespace-nowrap text-ink hover:border-ink"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
        {shown.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setDraft({ id: f.id, stay: f.stay ?? "", label: f.label, value: f.value, sub: f.sub ?? "" })}
            title="Edit"
            className="flex flex-col items-start justify-start border-r border-b border-[#F2EEE5] px-5 py-3 text-left hover:bg-surface-warm"
          >
            <div className="mb-1 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">{f.label}</div>
            <div className="text-[14.5px] leading-[1.4] text-ink-body">{f.value}</div>
            {f.sub && <div className="mt-0.5 text-[12.5px] text-[#6B655C]">{f.sub}</div>}
          </button>
        ))}
        {!draft && (
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY, stay: activeTab })}
            className="border-r border-b border-[#F2EEE5] px-5 py-3 text-left text-[13.5px] text-ink-soft hover:bg-surface-warm hover:text-ink"
          >
            + Add a field
          </button>
        )}
      </div>
      {form}
    </div>
  );
}
