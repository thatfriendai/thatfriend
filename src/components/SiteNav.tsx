import Link from "next/link";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-canvas/92 backdrop-blur-sm">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5.5 sm:px-14">
        <span className="text-[25px] tracking-tight font-display text-ink">
          &ldquo;that friend&rdquo;
        </span>
        <div className="hidden items-center gap-8.5 text-[14.5px] text-body md:flex">
          <a href="#for" className="hover:text-accent">
            Who it&rsquo;s for
          </a>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/planner/login"
            className="px-1 py-2.5 text-[14.5px] text-body hover:text-accent"
          >
            Sign in
          </Link>
          <Link
            href="/planner/trips/new"
            className="rounded-full bg-ink px-5.5 py-2.5 text-[14.5px] text-cream hover:bg-accent"
          >
            Start a trip
          </Link>
        </div>
      </nav>
    </header>
  );
}
