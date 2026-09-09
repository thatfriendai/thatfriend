"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAccountPanel() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/v2/users/me", { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPending(false);
      setError(data.error ?? "Could not delete your account.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2.5">
        <p className="text-[13.5px] text-body">This can&rsquo;t be undone. Delete your account for good?</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={confirmDelete}
            disabled={pending}
            className="rounded-full border border-red-700 px-4 py-1.5 text-[13.5px] text-red-700 hover:bg-red-700 hover:text-cream disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Yes, delete my account"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="text-[13.5px] text-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-[13px] text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-full border border-input-border bg-card px-4 py-1.5 text-[13.5px] text-ink hover:border-red-700 hover:text-red-700"
    >
      Delete my account
    </button>
  );
}
