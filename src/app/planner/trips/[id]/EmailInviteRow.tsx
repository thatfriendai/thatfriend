"use client";

import { useState } from "react";

type Status = "pending" | "sent" | "delivered" | "failed" | "bounced";

const STATUS_LABEL: Record<Status, string> = {
  pending: "Sending…",
  sent: "Invited",
  delivered: "Invited",
  failed: "Didn't go through",
  bounced: "Didn't go through",
};

/** One row in "Who's in" for an email invite that hasn't been accepted yet — the phone-invite row's sibling, but with a real send status. */
export function EmailInviteRow({ email, status, joinUrl }: { email: string; status: Status; joinUrl: string | null }) {
  const [copied, setCopied] = useState(false);
  const didntGoThrough = status === "failed" || status === "bounced";

  async function copyLink() {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied — nothing else to fall back to here.
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-input-border bg-transparent px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-input-border text-[13px] text-faint">
          ?
        </div>
        <span className="text-[15px] text-body">{email}</span>
        <span
          className={`ml-auto font-mono text-[11px] tracking-[0.08em] uppercase ${didntGoThrough ? "text-red-700" : "text-faint"}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>
      {didntGoThrough && joinUrl && (
        <div className="flex items-center gap-2.5 pl-10">
          <p className="text-[12.5px] text-muted">Invite to {email} didn&rsquo;t go through.</p>
          <button
            type="button"
            onClick={copyLink}
            className="flex-none rounded-full border border-input-border bg-card px-3 py-1 text-[12px] text-ink hover:border-ink"
          >
            {copied ? "Copied!" : "Copy link instead"}
          </button>
        </div>
      )}
    </div>
  );
}
