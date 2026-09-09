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
  savedCount,
  signOutAction,
}: {
  initial: string;
  username: string | null;
  tripsCount: number;
  savedCount: number;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useClickOutside(() => setMenuOpen(false));

  const items: { id: string; label: string; href: string; count?: number }[] = [
    { id: "home", label: "Home", href: "/planner/home" },
    { id: "trips", label: "Trips", href: "/planner/trips", count: tripsCount },
    { id: "explore", label: "Explore", href: "/planner/explore" },
    { id: "saved", label: "Saved", href: "/planner/trips?tab=saved", count: savedCount },
  ];

  function isActive(item: (typeof items)[number]) {
    if (item.id === "saved") return false;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card">
      <div className="mx-auto flex h-[66px] max-w-[1180px] items-center gap-6.5 px-8">
        <Link href="/planner/home" className="flex-none text-[23px] tracking-tight font-display text-ink">
          &ldquo;that friend&rdquo;
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14.5px] transition-colors ${
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

        <div className="flex flex-none items-center gap-3">
          <Link
            href="/planner/trips/new"
            className="rounded-full bg-ink px-5 py-2.5 text-[14.5px] text-cream hover:bg-accent"
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
                <Link href="/planner/friends" className="block rounded-xl px-3.5 py-2.5 text-[14.5px] text-ink-body hover:bg-surface-sunk">
                  Following
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
