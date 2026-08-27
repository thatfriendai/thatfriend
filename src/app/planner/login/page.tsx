import { LoginForm } from "./LoginForm";

export default async function PlannerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-cream px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-dashed border-border p-3 text-center text-xs text-muted">
        Placeholder page — not yet styled to the &quot;Sign in&quot; screen design.
      </div>
      <h1 className="font-display text-3xl text-ink">Sign in</h1>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="w-full max-w-sm">
        <LoginForm token={token} />
      </div>
    </div>
  );
}
