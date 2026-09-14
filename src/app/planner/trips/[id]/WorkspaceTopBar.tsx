"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TripNameField } from "./TripNameField";

const SECTION_IDS = ["trip101", "places", "stays", "decisions", "resources", "itinerary"];

function useActiveSection() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const elements = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px" }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return active;
}

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

function NavCount({ n, accent }: { n: number; accent?: boolean }) {
  if (n === 0 && !accent) return null;
  return (
    <span
      className={
        accent
          ? "ml-1.5 rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] text-on-accent"
          : "ml-1.5 font-mono text-[11px] text-faint"
      }
    >
      {n}
    </span>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`flex items-center px-3 py-2 text-[13.5px] transition-colors ${
        active ? "text-ink" : "text-muted hover:text-ink"
      }`}
      style={{ borderBottom: active ? "2px solid var(--color-accent)" : "2px solid transparent" }}
    >
      {children}
    </a>
  );
}

function initialsOf(name: string) {
  return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function WorkspaceTopBar({
  tripId,
  tripName,
  dateRange,
  travellerCount,
  roster,
  avatarColors,
  navInitial,
  navUsername,
  signOutAction,
  navCounts,
}: {
  tripId: string;
  tripName: string;
  dateRange: string | null;
  travellerCount: number;
  roster: { label: string }[];
  avatarColors: readonly string[];
  navInitial: string;
  navUsername: string | null;
  signOutAction: () => Promise<void>;
  navCounts: {
    places: number;
    stays: number;
    sources: number;
    decisions: number;
    decisionsNeedVote: boolean;
  };
}) {
  const router = useRouter();
  const active = useActiveSection();
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const addRef = useClickOutside(() => setAddOpen(false));
  const menuRef = useClickOutside(() => setMenuOpen(false));

  function openAdd(kind: "place" | "link" | "decision" | "day") {
    setAddOpen(false);
    const anchor = kind === "decision" ? "decisions" : kind === "day" ? "itinerary" : "places";
    router.push(`/planner/trips/${tripId}?openAdd=${kind}#${anchor}`);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card">
      <div className="flex flex-wrap items-center gap-y-2 px-5 py-3 sm:px-7">
        <Link href="/planner/home" className="flex-none text-xl font-display text-ink">
          &ldquo;that friend&rdquo;
        </Link>
        <div className="mx-4 hidden h-5 w-px bg-border sm:block" />
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <TripNameField tripId={tripId} initialName={tripName} />
            <p className="mt-0.5 font-mono text-[11px] text-muted">
              {dateRange ?? "Dates not set"} &middot; {travellerCount}{" "}
              {travellerCount === 1 ? "traveller" : "travellers"}
            </p>
          </div>
          {roster.length > 1 && (
            <div className="flex flex-none">
              {roster.slice(0, 5).map((m, i) => (
                <div
                  key={i}
                  className="ml-[-5px] flex h-6.5 w-6.5 items-center justify-center rounded-full border-2 border-card text-[11px] text-cream"
                  style={{ background: avatarColors[i % avatarColors.length] }}
                  title={m.label}
                >
                  {initialsOf(m.label)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fixed at exactly two objects, regardless of trip state — Add and the profile menu. */}
        <div className="ml-auto flex flex-none items-center gap-3">
          <div ref={addRef} className="relative">
            <button
              onClick={() => setAddOpen((v) => !v)}
              className="flex items-center gap-1 whitespace-nowrap rounded-full bg-accent px-4 py-2 text-[13.5px] text-on-accent hover:opacity-90"
            >
              + Add <span className="text-[10px]">&#9662;</span>
            </button>
            {addOpen && (
              <div className="absolute right-0 z-30 mt-1.5 w-40 rounded-xl border border-border bg-card py-1.5 shadow-md">
                {[
                  { key: "place" as const, label: "A place" },
                  { key: "link" as const, label: "A link" },
                  { key: "decision" as const, label: "A decision" },
                  { key: "day" as const, label: "A day" },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => openAdd(item.key)}
                    className="block w-full px-4 py-2 text-left text-[13.5px] text-ink-body hover:bg-border-soft"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] text-on-accent"
              style={{ background: "var(--color-accent)" }}
            >
              {navInitial}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 z-30 w-48 rounded-2xl border border-border bg-card p-1.5 shadow-md">
                <Link
                  href={navUsername ? `/planner/u/${navUsername}` : "/planner/profile"}
                  className="block rounded-xl px-3.5 py-2.5 text-[14.5px] text-ink-body hover:bg-surface-sunk"
                >
                  Profile
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

      <div className="flex items-center overflow-x-auto px-5 sm:px-7">
        <NavLink href="#trip101" active={active === "trip101" || active === null}>
          Trip 101
        </NavLink>
        <NavLink href="#places" active={active === "places"}>
          Places
          <NavCount n={navCounts.places} />
        </NavLink>
        <NavLink href="#stays" active={active === "stays"}>
          Stays
          <NavCount n={navCounts.stays} />
        </NavLink>
        <NavLink href="#resources" active={active === "resources"}>
          Sources
          <NavCount n={navCounts.sources} />
        </NavLink>
        <NavLink href="#decisions" active={active === "decisions"}>
          Decisions
          <NavCount n={navCounts.decisions} accent={navCounts.decisionsNeedVote} />
        </NavLink>
      </div>
    </header>
  );
}
