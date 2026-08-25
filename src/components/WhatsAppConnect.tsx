"use client";

import { useState, useTransition } from "react";
import { getWhatsAppConnectCode } from "@/app/trip/[id]/actions";
import { useGuestIdentity } from "@/components/GuestIdentity";

interface ConnectState {
  code?: string;
  phoneNumber?: string | null;
  error?: string;
}

export function WhatsAppConnect({
  tripId,
  whatsappNumber,
}: {
  tripId: string;
  whatsappNumber: string;
}) {
  const { name, participantId, setParticipantId } = useGuestIdentity();
  const [state, setState] = useState<ConnectState | null>(null);
  const [isPending, startTransition] = useTransition();

  function fetchCode() {
    startTransition(async () => {
      const result = await getWhatsAppConnectCode(tripId, name, participantId);
      if (result.participantId) setParticipantId(result.participantId);
      setState(result);
    });
  }

  if (!whatsappNumber) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-lg text-ink">Connect WhatsApp</h3>
      <p className="mt-1 text-sm text-muted">
        Text your notes straight to That Friend and skip the web form.
      </p>

      {state?.phoneNumber ? (
        <p className="mt-3 text-sm text-accent">
          Connected — texts from {state.phoneNumber} log straight to this trip.
        </p>
      ) : state?.code ? (
        <p className="mt-3 text-sm text-ink">
          Text <span className="font-semibold">{state.code}</span> to{" "}
          <span className="font-semibold">{whatsappNumber}</span> to link your
          WhatsApp.
        </p>
      ) : (
        <button
          type="button"
          onClick={fetchCode}
          disabled={isPending}
          className="mt-3 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-cream disabled:opacity-50"
        >
          {isPending ? "Getting your code…" : "Get my WhatsApp code"}
        </button>
      )}
      {state?.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
    </div>
  );
}
