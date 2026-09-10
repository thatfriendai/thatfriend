"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPhoneDisplay } from "@/lib/planner/phone";

type Step = "idle" | "sent";

export function PhoneLinkPanel({
  currentPhone,
  initialWhatsAppOptIn,
}: {
  currentPhone: string | null;
  initialWhatsAppOptIn: boolean;
}) {
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatsappOptIn, setWhatsappOptIn] = useState(initialWhatsAppOptIn);
  const [channelPending, setChannelPending] = useState(false);

  async function toggleWhatsApp(next: boolean) {
    setWhatsappOptIn(next);
    setChannelPending(true);
    const res = await fetch("/api/v2/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsapp_opt_in: next }),
    });
    setChannelPending(false);
    if (!res.ok) setWhatsappOptIn(!next);
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/v2/auth/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not send that code.");
      return;
    }
    setStep("sent");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/v2/auth/verify-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not verify that code.");
      return;
    }
    setChanging(false);
    setStep("idle");
    setPhone("");
    setCode("");
    router.refresh();
  }

  if (!changing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[15.5px] text-ink">
            {currentPhone ? formatPhoneDisplay(currentPhone) : "No phone number"}
          </span>
          {currentPhone && (
            <span className="rounded-full border border-input-border font-mono text-[9.5px] tracking-[0.08em] text-muted uppercase px-2 py-0.5">
              Verified
            </span>
          )}
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="text-[13.5px] text-muted hover:text-accent"
          >
            {currentPhone ? "Change" : "Add a phone number"}
          </button>
        </div>
        {currentPhone && (
          <label className="flex items-center gap-2 text-[13.5px] text-body">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              disabled={channelPending}
              onChange={(e) => toggleWhatsApp(e.target.checked)}
            />
            Use WhatsApp instead of SMS for texts to and from That Friend
          </label>
        )}
      </div>
    );
  }

  if (step === "sent") {
    return (
      <form onSubmit={verifyCode} className="flex flex-col gap-2.5">
        <p className="text-[13.5px] text-body">Texted a 6-digit code to {phone} — enter it below.</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            autoFocus
            className="rounded-full border border-input-border bg-card px-4 py-2 text-center text-[15px] tracking-[0.25em] text-ink outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-ink px-4 py-2 text-[13.5px] text-cream hover:bg-accent disabled:opacity-50"
          >
            {pending ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            onClick={() => {
              setChanging(false);
              setStep("idle");
              setError(null);
            }}
            className="text-[13.5px] text-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
        {error && <span className="text-[13px] text-red-700">{error}</span>}
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="flex flex-wrap items-center gap-2.5">
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+1 415 555 0100"
        autoFocus
        className="rounded-full border border-input-border bg-card px-4 py-2 text-[15px] text-ink outline-none focus:border-ink"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-4 py-2 text-[13.5px] text-cream hover:bg-accent disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send code"}
      </button>
      <button
        type="button"
        onClick={() => setChanging(false)}
        className="text-[13.5px] text-muted hover:text-ink"
      >
        Cancel
      </button>
      {error && <span className="text-[13px] text-red-700">{error}</span>}
    </form>
  );
}
