"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "email" | "phone";
type Step = "lookup" | "known" | "new";

function tabClass(on: boolean) {
  return `flex-1 rounded-full border py-2.5 text-center text-sm transition-colors ${
    on
      ? "border-ink bg-[#F0EBE1] text-ink-soft"
      : "border-border bg-card text-muted hover:border-ink"
  }`;
}

export function AuthPanel({ token }: { token?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("email");
  const [cred, setCred] = useState("");
  const [step, setStep] = useState<Step | null>(null);
  const [name, setName] = useState("");
  const [waOptIn, setWaOptIn] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const v = cred.trim();
    if (!v) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/v2/auth/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "email" ? { email: v } : { phone: v }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setStep(data.exists ? "known" : "new");
  }

  async function sendCode(withName?: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/v2/auth/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "email"
            ? {
                email: cred.trim(),
                token,
                name: withName,
                whatsapp_opt_in: withName ? waOptIn : undefined,
              }
            : { phone: cred.trim() }
        ),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setPending(false);
        return;
      }
      setSent(true);
      setPending(false);
    } catch {
      setError("That's taking too long — the email server may be rate-limited. Try again in a bit.");
      setPending(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    const code = codeInput.trim();
    if (!code) return;
    setVerifying(true);
    setError(null);
    const res = await fetch("/api/v2/auth/verify-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cred.trim(), code }),
    });
    const data = await res.json().catch(() => ({}));
    setVerifying(false);
    if (!res.ok) {
      setError(data.error ?? "Could not verify that code.");
      return;
    }
    router.push(data.redirect ?? "/planner/trips");
  }

  if (sent && mode === "phone") {
    return (
      <form onSubmit={verifyCode}>
        <p className="mb-3.5 text-[15px] text-ink-soft">
          Texted a 6-digit code to {cred} on WhatsApp — enter it below.
        </p>
        <input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          placeholder="123456"
          inputMode="numeric"
          autoFocus
          className="mb-3 w-full rounded-full border border-input-border bg-card px-5 py-3.5 text-center text-[17px] tracking-[0.3em] text-ink outline-none focus:border-ink"
        />
        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={verifying || !codeInput.trim()}
          className="w-full rounded-full bg-ink py-3.5 text-[15.5px] text-cream hover:bg-accent disabled:opacity-50"
        >
          {verifying ? "Checking…" : "Verify and sign in"}
        </button>
      </form>
    );
  }

  if (sent) {
    return (
      <p className="text-[15px] text-ink-soft">
        Check your email for a link to finish signing in.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3.5 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("email");
            setStep(null);
            setCred("");
          }}
          className={tabClass(mode === "email")}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("phone");
            setStep(null);
            setCred("");
          }}
          className={tabClass(mode === "phone")}
        >
          Phone number
        </button>
      </div>

      <label className="mb-2 block text-sm text-body">
        {mode === "email" ? "Email" : "Phone number"}
      </label>
      <input
        value={cred}
        onChange={(e) => setCred(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !step) handleLookup(e);
        }}
        disabled={step !== null}
        placeholder={mode === "email" ? "you@email.com" : "+1 415 555 0100"}
        className="mb-3 w-full rounded-full border border-input-border bg-card px-5 py-3.5 text-[15.5px] text-ink outline-none focus:border-ink disabled:opacity-70"
      />

      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

      {step === null && (
        <>
          <button
            onClick={handleLookup}
            disabled={pending}
            className="w-full rounded-full bg-ink py-3.5 text-[15.5px] text-cream hover:bg-accent disabled:opacity-50"
          >
            Continue
          </button>
          <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
            {mode === "phone"
              ? "We'll check for an account on that number. Your number is also how the WhatsApp bot knows which trip to file your notes under."
              : "We'll check whether you already have an account. No password either way."}
          </p>
        </>
      )}

      {step === "known" && (
        <>
          <p className="mb-3.5 text-sm text-body">
            Found your account. Sending a code, no password needed.
          </p>
          <button
            onClick={() => sendCode()}
            disabled={pending}
            className="w-full rounded-full bg-ink py-3.5 text-[15.5px] text-cream hover:bg-accent disabled:opacity-50"
          >
            {pending ? "Sending…" : mode === "email" ? "Send sign-in link" : "Text me a code"}
          </button>
        </>
      )}

      {step === "new" && (
        <>
          <div className="my-5 border-t border-border-soft" />
          <p className="mb-2.5 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
            No account yet
          </p>
          <p className="mb-5 text-[15.5px] leading-relaxed text-ink-soft">
            Nothing under {cred || "that address"}. Add your name and
            you&rsquo;re set up in one step.
          </p>
          <label className="mb-2 block text-sm text-body">Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Priya Raman"
            className="mb-3.5 w-full rounded-full border border-input-border bg-card px-5 py-3.5 text-[15.5px] text-ink outline-none focus:border-ink"
          />
          <div
            onClick={() => setWaOptIn((v) => !v)}
            className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[#DCE6E3] bg-[#F2F7F5] p-3.5"
          >
            <span
              className={`mt-0.5 h-[19px] w-[19px] flex-none rounded-[5px] border ${
                waOptIn ? "border-[#4F7A6B] bg-[#4F7A6B]" : "border-[#C6D5D0] bg-card"
              }`}
            />
            <div>
              <p className="text-[14.5px] text-ink-soft">Use the WhatsApp bot</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-[#6B7F78]">
                Forward recs to the That Friend number and they land in the
                trip. Nudges come back the same way.
              </p>
            </div>
          </div>
          <button
            onClick={() => sendCode(name || "You")}
            disabled={pending || !name.trim()}
            className="w-full rounded-full bg-ink py-3.5 text-[15.5px] text-cream hover:bg-accent disabled:opacity-50"
          >
            {pending ? "Sending…" : "Create account"}
          </button>
          <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
            Next you&rsquo;ll answer a few questions about this trip.{" "}
            <button
              type="button"
              onClick={() => {
                setStep(null);
                setCred("");
              }}
              className="underline"
            >
              Use a different {mode === "email" ? "email" : "number"}
            </button>
          </p>
        </>
      )}
    </div>
  );
}
