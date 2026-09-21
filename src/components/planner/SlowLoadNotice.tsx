"use client";

import { useEffect, useState } from "react";

/**
 * Nothing for the first ~1.6s — past that, a message appears rather than
 * leaving the screen looking dead while a heavy server fetch runs.
 */
export function SlowLoadNotice({
  message = "Taking you there right now",
  inline = false,
}: {
  message?: string;
  /** Inside a modal or panel, rather than filling the viewport. */
  inline?: boolean;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 1600);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className={`flex items-center justify-center px-6 ${inline ? "py-10" : "min-h-screen"}`}>
      <div className="rounded-full border border-input-border bg-card px-6 py-3.5 text-[17px] text-ink shadow-sm">
        {message} ✈️
      </div>
    </div>
  );
}
