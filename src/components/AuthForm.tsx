"use client";

import { useActionState } from "react";
import { signInWithGoogle } from "@/app/auth/actions";

type AuthAction = (
  prevState: unknown,
  formData: FormData
) => Promise<{ error?: string; message?: string } | void>;

export function AuthForm({
  action,
  submitLabel,
  tripName,
}: {
  action: AuthAction;
  submitLabel: string;
  tripName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-4">
        {tripName && <input type="hidden" name="trip_name" value={tripName} />}
        <label className="flex flex-col gap-1.5 text-sm text-ink/80">
          Email
          <input
            type="email"
            name="email"
            required
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-ink focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink/80">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={6}
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-ink focus:border-accent focus:outline-none"
          />
        </label>
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        {state?.message && (
          <p className="text-sm text-accent">{state.message}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink disabled:opacity-50"
        >
          {pending ? "Please wait…" : submitLabel}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="w-full rounded-full border border-border px-5 py-2.5 text-sm font-medium text-ink hover:bg-card"
        >
          Continue with Google
        </button>
      </form>
    </div>
  );
}
