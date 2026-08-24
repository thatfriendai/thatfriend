"use client";

import { useActionState } from "react";
import { signInWithGoogle } from "@/app/auth/actions";

type AuthAction = (
  prevState: unknown,
  formData: FormData
) => Promise<{ error: string } | void>;

export function AuthForm({
  action,
  submitLabel,
}: {
  action: AuthAction;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            name="email"
            required
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={6}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? "Please wait…" : submitLabel}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        or
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="w-full rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
        >
          Continue with Google
        </button>
      </form>
    </div>
  );
}
