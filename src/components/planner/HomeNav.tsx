"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

export function HomeNav({
  initial,
  username,
  tripsCount,
  signOutAction,
}: {
  initial: string;
  username: string | null;
  tripsCount: number;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useClickOutside(() => setMenuOpen(false));

  // "Saved" isn't its own top-level destination — it's the Saved tab on
  // Trips (/planner/trips?tab=saved), so a separate nav pill for it was
  // just a second path to the same page.
  const items: { id: string; label: string; href: string; count?: number }[] = [
    { id: "home", label: "Home", href: "/planner/home" },
    { id: "trips", label: "Trips", href: "/planner/trips", count: tripsCount },
    { id: "explore", label: "Explore", href: "/planner/explore" },
  ];

  function isActive(item: (typeof items)[number]) {
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card">
      {/* One row on desktop. On a phone the three pills, "Start a trip" and
          the avatar can't share 390px with the wordmark, so the pills drop
          to their own row underneath instead of overlapping. */}
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:h-[66px] sm:flex-nowrap sm:gap-6.5 sm:px-8 sm:py-0">
        <Link href="/planner/home" className="flex-none text-[21px] tracking-tight font-display text-ink sm:text-[23px]">
          &ldquo;that friend&rdquo;
        </Link>

        <nav className="order-last -mx-1 flex basis-full items-center gap-1 overflow-x-auto pt-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:order-none sm:mx-0 sm:min-w-0 sm:flex-1 sm:basis-auto sm:overflow-visible sm:p-0">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[14.5px] transition-colors ${
                  active ? "bg-ink text-cream" : "text-body hover:bg-surface-sunk"
                }`}
              >
                {item.label}
                {typeof item.count === "number" && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                      active ? "bg-cream/20 text-cream" : "bg-surface-sunk text-muted"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex flex-none items-center gap-2.5 sm:ml-0 sm:gap-3">
          <Link
            href="/planner/trips/new"
            className="whitespace-nowrap rounded-full bg-ink px-4 py-2 text-[14px] text-cream hover:bg-accent sm:px-5 sm:py-2.5 sm:text-[14.5px]"
          >
            Start a trip
          </Link>
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] text-on-accent"
              style={{ background: "var(--color-accent)" }}
            >
              {initial}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 w-54 rounded-2xl border border-border bg-card p-1.5 shadow-md">
                <Link
                  href={username ? `/planner/u/${username}` : "/planner/profile"}
                  className="block rounded-xl px-3.5 py-2.5 text-[14.5px] text-ink-body hover:bg-surface-sunk"
                >
                  Your profile
                </Link>
                <Link href="/planner/profile" className="block rounded-xl px-3.5 py-2.5 text-[14.5px] text-ink-body hover:bg-surface-sunk">
                  Settings
                </Link>
                <div className="my-1.5 h-px bg-border-soft" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    signOutAction();
                  }}
                  className="block w-full rounded-xl px-3.5 py-2.5 text-left text-[14.5px] text-muted hover:bg-surface-sunk"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
