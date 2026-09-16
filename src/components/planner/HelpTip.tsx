"use client";

import { useState } from "react";
import { setLocalStorageItem, useLocalStorageItem } from "@/lib/local-storage-store";

const STORAGE_KEY = "ttf-help-dismissed";

function parseDismissed(raw: string | null): Set<string> {
  try {
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * One-line-what, one-line-to-do tooltip. Hover to see it; dismissing kills
 * that tip only (remembered in localStorage), so the rest keep teaching.
 */
export function HelpTip({
  id,
  what,
  todo,
  align = "left",
  children,
}: {
  id: string;
  what: string;
  todo: string;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const dismissedRaw = useLocalStorageItem(STORAGE_KEY);
  const dismissed = parseDismissed(dismissedRaw).has(id);

  function dismiss() {
    const next = parseDismissed(dismissedRaw);
    next.add(id);
    try {
      setLocalStorageItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // best-effort only
    }
    setHover(false);
  }

  const show = hover && !dismissed;

  return (
    <span
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      {show && (
        <div
          className={`absolute top-full z-30 mt-1.5 w-[248px] rounded-[10px] bg-ink px-3.5 py-3 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="mb-1.5 text-[14.5px] leading-[1.45] text-cream">{what}</div>
          <div className="mb-2.5 text-[13.5px] leading-[1.45] text-[#B8B1A6]">{todo}</div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-[#4A453E] px-2.5 py-1 font-mono text-[10.5px] tracking-[0.1em] text-cream uppercase hover:border-cream"
          >
            Got it
          </button>
        </div>
      )}
    </span>
  );
}
