import Link from "next/link";

export function SiteNav() {
  return (
    <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
      <Link
        href="/"
        className="font-display text-lg lowercase tracking-tight text-ink"
      >
        that friend
      </Link>
      <div className="hidden items-center gap-8 text-sm text-ink/80 md:flex">
        <a href="#how-it-works" className="hover:text-ink">
          How it works
        </a>
        <a href="#workspace" className="hover:text-ink">
          The workspace
        </a>
        <a href="#nudging" className="hover:text-ink">
          Nudging
        </a>
      </div>
      <div className="flex items-center gap-5">
        <Link href="/login" className="text-sm text-ink/80 hover:text-ink">
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:bg-accent"
        >
          Start a trip
        </Link>
      </div>
    </nav>
  );
}
