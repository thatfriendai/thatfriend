"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "sent_returning" | "already_member" | "invalid" | "error";

const STATUS_COPY: Record<Exclude<Status, "idle" | "sending">, string> = {
  sent: "Invite sent — they'll get a text and can reply 1 to join.",
  sent_returning: "Invite sent — they've used That Friend before, so it's a short one.",
  already_member: "They're already on this trip.",
  invalid: "That doesn't look like a valid US number.",
  error: "Something went wrong — try again.",
};

export function InviteFriendByPhone({ tripId }: { tripId: string }) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function send() {
    const value = phone.trim();
    if (!value) return;
    setStatus("sending");
    const res = await fetch(`/api/v2/trips/${tripId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ phone: value }]),
    });
    const data = await res.json().catch(() => ({}));
    const result = data.phoneResults?.[0] as { status?: Status } | undefined;
    const resultStatus = result?.status ?? "error";
    setStatus(resultStatus);
    if (resultStatus === "sent" || resultStatus === "sent_returning") setPhone("");
  }

  return (
    <div>
      <p className="mb-2 text-[14px] text-body">Invite a friend by phone — they get a text and can reply 1 to join.</p>
      <div className="flex gap-2.5">
        <input
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setStatus("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          placeholder="+1 415 555 0100"
          className="flex-1 rounded-xl border border-input-border bg-card px-4.5 py-3.5 text-[15px] text-ink outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={send}
          disabled={status === "sending" || !phone.trim()}
          className="flex-none rounded-xl bg-ink px-5.5 py-3.5 text-[14.5px] text-cream hover:bg-accent disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : "Invite"}
        </button>
      </div>
      {status !== "idle" && status !== "sending" && (
        <p className={`mt-2 text-[13px] ${status === "sent" || status === "sent_returning" ? "text-body" : "text-red-700"}`}>
          {STATUS_COPY[status]}
        </p>
      )}
    </div>
  );
}
