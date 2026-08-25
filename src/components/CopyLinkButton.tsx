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
      className="w-fit rounded-full border border-border bg-card px-4 py-2 text-sm text-ink hover:border-accent"
    >
      {copied ? "Link copied!" : "Copy shareable link"}
    </button>
  );
}
