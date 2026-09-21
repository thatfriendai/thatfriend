"use client";

import { useState } from "react";

/**
 * The organizer's one button. On a phone it opens the native share sheet
 * with the trip link — text it, drop it in the group chat, email it, her
 * call. Where there's no share sheet (desktop browsers, mostly) it copies
 * the link instead, and the tap-to-copy stays available under the sheet
 * everywhere as the fallback for "I'd rather paste it myself".
 */
export function InviteButton({
  url,
  tripName,
  organizerFirstName,
}: {
  url: string;
  tripName: string;
  organizerFirstName: string;
}) {
  const [copied, setCopied] = useState(false);

  const text = `${organizerFirstName} added you to the ${tripName} trip on That Friend`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied — the link is still shown below.
    }
  }

  async function share() {
    // Decided at tap time rather than render time, so the server and the
    // first client render agree on the markup.
    if (typeof navigator.share !== "function") return copy();
    try {
      await navigator.share({ title: tripName, text, url });
    } catch (e) {
      // A dismissed sheet rejects with AbortError — nothing to do. Anything
      // else (a browser that lies about supporting share) falls back to copy.
      if ((e as { name?: string }).name !== "AbortError") await copy();
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4.5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={share}
          className="rounded-full bg-ink px-6 py-3 text-[15px] text-cream hover:bg-accent"
        >
          {copied ? "Link copied" : "Invite"}
        </button>
        <p className="min-w-[12em] flex-1 text-[14px] leading-snug text-body">
          One link — text it, drop it in the group chat, whatever works. They tap it once and they&rsquo;re in.
        </p>
      </div>
      <div className="mt-3.5 flex items-center gap-2.5">
        <div className="min-w-0 flex-1 overflow-hidden rounded-[10px] border border-border-soft bg-[#FBF9F3] px-3.5 py-2.5 font-mono text-[12.5px] text-nowrap text-ellipsis text-body">
          {url}
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex-none rounded-[10px] border border-input-border bg-card px-4 py-2.5 text-[13.5px] whitespace-nowrap text-ink hover:border-ink"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
