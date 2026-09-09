import Link from "next/link";

function pillClass(active: boolean) {
  return active
    ? "rounded-full bg-ink px-5 py-2 text-[14px] text-cream"
    : "rounded-full border border-input-border bg-card px-5 py-2 text-[14px] text-ink hover:border-ink";
}

export function ExploreNav({
  active,
  tripsAndSavedCount,
}: {
  active: "explore" | "trips" | "following";
  tripsAndSavedCount: number;
}) {
  return (
    <div className="mb-9 flex flex-wrap items-center gap-3">
      <Link href="/planner/explore" className={pillClass(active === "explore")}>
        Explore
      </Link>
      <span className="ml-2 font-mono text-[11px] tracking-[0.08em] text-faint uppercase">Your profile</span>
      <Link href="/planner/trips" className={pillClass(active === "trips")}>
        Trips &amp; saved &middot; {tripsAndSavedCount}
      </Link>
      <Link href="/planner/friends" className={pillClass(active === "following")}>
        Following
      </Link>
    </div>
  );
}
