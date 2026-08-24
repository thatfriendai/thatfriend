"use client";

import { useState } from "react";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
    >
      {copied ? "Link copied!" : "Copy shareable link"}
    </button>
  );
}
