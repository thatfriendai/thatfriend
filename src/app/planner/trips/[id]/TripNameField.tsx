"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** The trip name — in the header bar, or as the page's own H1 — is itself the rename field, no separate menu or modal. */
export function TripNameField({
  tripId,
  initialName,
  className,
}: {
  tripId: string;
  initialName: string;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === initialName) {
      setValue(initialName);
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/v2/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setSaving(false);
    if (!res.ok) {
      setValue(initialName);
      return;
    }
    router.refresh();
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") inputRef.current?.blur();
        if (e.key === "Escape") {
          setValue(initialName);
          inputRef.current?.blur();
        }
      }}
      disabled={saving}
      title="Click to rename"
      className={
        className ??
        "w-full min-w-0 truncate rounded-md border border-transparent bg-transparent p-0 text-[15px] font-medium text-ink outline-none hover:border-input-border focus:border-ink disabled:opacity-60"
      }
    />
  );
}
