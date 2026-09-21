import Link from "next/link";

/**
 * What a friend sees when they open an invite link, before the one tap:
 * whose trip, where, when, who's already in. Shared by the trip-wide share
 * link (src/app/planner/join/[token]) and the per-phone invite link
 * (src/app/j/[token]) so the two never drift apart.
 */
export function JoinTripPreview({
  ownerName,
  tripName,
  destination,
  dateRange,
  memberNames,
  signedIn,
  children,
}: {
  ownerName: string;
  tripName: string;
  destination: string | null;
  dateRange: string | null;
  memberNames: string[];
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const shownNames = memberNames.slice(0, 4);
  const more = memberNames.length - shownNames.length;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-14 sm:py-6">
        <span className="text-xl font-display text-ink">&ldquo;that friend&rdquo;</span>
        {!signedIn && (
          <p className="text-sm text-muted">
            Already have an account?{" "}
            <Link href="/planner/login" className="text-ink underline">
              Sign in
            </Link>
          </p>
        )}
      </header>

      <div className="mx-auto my-auto w-full max-w-[620px] px-6 py-10 pb-20">
        <p className="mb-5 font-mono text-[11.5px] tracking-[0.14em] text-muted uppercase">{ownerName} added you</p>
        <h1 className="mb-4 text-[44px] leading-[1.04] font-display tracking-tight text-ink sm:text-5xl">{tripName}</h1>
        <div className="mb-9 flex flex-col gap-2 text-[16px] text-body">
          {destination && destination !== tripName && <p>{destination}</p>}
          <p>{dateRange ?? "Dates still open"}</p>
          {memberNames.length > 0 && (
            <p>
              {shownNames.join(", ")}
              {more > 0 ? ` and ${more} more` : ""} {memberNames.length === 1 ? "is" : "are"} in
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
