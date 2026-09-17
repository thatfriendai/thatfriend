"use client";

import { useState } from "react";

export function JoinLinkButton({
  smsNumber,
  smsNumberDisplay,
  joinCode,
  isIOS,
}: {
  smsNumber: string;
  smsNumberDisplay: string;
  joinCode: string;
  isIOS: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const text = `JOIN ${joinCode}`;
  // iOS Safari only reliably prefills an sms: body with "&body=", not
  // "?body=" — Android's handling of either form varies by OEM messaging
  // app, so it gets the same best-effort attempt plus a visible fallback
  // below regardless of whether the prefill actually took.
  const smsHref = isIOS
    ? `sms:${smsNumber}&body=${encodeURIComponent(text)}`
    : `sms:${smsNumber}?body=${encodeURIComponent(text)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied — the code is still shown either way.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <a
        href={smsHref}
        className="flex items-center justify-center rounded-full bg-ink px-7 py-4 text-[16px] text-cream hover:bg-accent"
      >
        Text &ldquo;{text}&rdquo; to join
      </a>
      <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-4.5">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[15px] tracking-[0.08em] text-ink">{text}</div>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Or text this to {smsNumberDisplay} yourself.
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex-none rounded-[10px] border border-input-border bg-card px-5 py-3 text-[14.5px] whitespace-nowrap text-ink hover:border-ink"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
