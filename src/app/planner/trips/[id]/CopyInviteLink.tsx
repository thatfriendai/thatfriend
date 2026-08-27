"use client";

import { useState } from "react";

export function CopyInviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-4.5">
      <div className="min-w-0 flex-1 overflow-hidden rounded-[10px] border border-border-soft bg-[#FBF9F3] px-3.5 py-3 font-mono text-[13px] text-nowrap text-ellipsis text-body">
        {url}
      </div>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="rounded-[10px] bg-ink px-5 py-3 text-[14.5px] whitespace-nowrap text-cream hover:bg-accent"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
