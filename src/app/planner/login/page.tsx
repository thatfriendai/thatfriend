import { AuthPanel } from "./AuthPanel";
import { TripPreviewCard } from "@/components/TripPreviewCard";

export default async function PlannerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="flex flex-col px-8 py-10 sm:px-16">
        <span className="text-xl font-display text-ink">&ldquo;that friend&rdquo;</span>
        <div className="my-auto w-full max-w-[400px] py-10">
          <h1 className="mb-3 text-5xl leading-[1.06] font-display tracking-tight text-ink">
            Sign in or sign up.
          </h1>
          <p className="mb-8 text-base leading-relaxed text-body">
            One box for both. Put in your email or your number and
            we&rsquo;ll take you to the right place. No password to forget,
            no app to download.
          </p>
          {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
          <AuthPanel token={token} />
          <p className="mt-6 text-[13px] text-faint">
            Invited by a friend? Use the same email they sent the link to.
          </p>
        </div>
      </div>
      <div className="hidden flex-col justify-center gap-7 bg-dark px-10 py-14 lg:flex">
        <TripPreviewCard dark />
        <p className="max-w-[22em] text-2xl leading-snug font-display text-[#E8E2D6]">
          &ldquo;Six of us, four cities, one doc. It took a week instead of a
          year.&rdquo;
        </p>
      </div>
    </div>
  );
}
