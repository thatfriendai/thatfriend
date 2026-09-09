"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AttentionItem } from "@/lib/planner/attention";

const SECTION_IDS = ["places", "stays", "decisions", "resources", "itinerary"];

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

export function WorkspaceTopBar({
  tripId,
  tripName,
  dateRange,
  travellerCount,
  roster,
  avatarColors,
  datesLabel,
  primary,
  navCounts,
}: {
  tripId: string;
  tripName: string;
  dateRange: string | null;
  travellerCount: number;
  roster: { label: string }[];
  avatarColors: readonly string[];
  datesLabel: string;
  primary: AttentionItem | null;
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
  const [moreOpen, setMoreOpen] = useState(false);
  const addRef = useClickOutside(() => setAddOpen(false));
  const moreRef = useClickOutside(() => setMoreOpen(false));

  function initialsOf(name: string) {
    return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  }

  function openAdd(kind: "place" | "link" | "decision" | "day") {
    setAddOpen(false);
    const anchor = kind === "decision" ? "decisions" : kind === "day" ? "itinerary" : "places";
    router.push(`/planner/trips/${tripId}?openAdd=${kind}#${anchor}`);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card">
      <div className="flex flex-wrap items-center gap-y-2 px-5 py-3 sm:px-7">
        <Link href="/planner/home" className="text-xl font-display text-ink">
          &ldquo;that friend&rdquo;
        </Link>
        <div className="mx-4 hidden h-5 w-px bg-border sm:block" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-ink">{tripName}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted">
            {dateRange ?? "Dates not set"} &middot; {travellerCount}{" "}
            {travellerCount === 1 ? "traveller" : "travellers"}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex">
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

          {primary && (
            <Link
              href={primary.href}
              className="whitespace-nowrap rounded-full bg-accent px-4 py-2 text-[13.5px] text-on-accent hover:opacity-90"
            >
              {primary.cta}
            </Link>
          )}

          <div ref={addRef} className="relative">
            <button
              onClick={() => setAddOpen((v) => !v)}
              className={
                primary
                  ? "flex items-center gap-1 whitespace-nowrap rounded-full border border-input-border bg-card px-4 py-2 text-[13.5px] text-ink hover:border-ink"
                  : "flex items-center gap-1 whitespace-nowrap rounded-full bg-accent px-4 py-2 text-[13.5px] text-on-accent hover:opacity-90"
              }
            >
              + Add <span className="text-[10px]">&#9662;</span>
            </button>
            {addOpen && (
              <div className="absolute right-0 z-30 mt-1.5 w-40 rounded-xl border border-border bg-card py-1.5 shadow-md">
                {[
                  { key: "place" as const, label: "Place" },
                  { key: "link" as const, label: "Link" },
                  { key: "decision" as const, label: "Decision" },
                  { key: "day" as const, label: "Day" },
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

          <div ref={moreRef} className="relative">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="rounded-full px-2.5 py-2 text-[15px] text-muted hover:bg-border-soft hover:text-ink"
              aria-label="More"
            >
              &middot;&middot;&middot;
            </button>
            {moreOpen && (
              <div className="absolute right-0 z-30 mt-1.5 w-48 rounded-xl border border-border bg-card py-1.5 shadow-md">
                <Link
                  href={`/planner/trips/${tripId}/dates`}
                  className="block px-4 py-2 text-[13.5px] text-ink-body hover:bg-border-soft"
                >
                  {datesLabel}
                </Link>
                <Link
                  href={`/planner/trips/${tripId}/preferences`}
                  className="block px-4 py-2 text-[13.5px] text-ink-body hover:bg-border-soft"
                >
                  Your preferences
                </Link>
                <Link
                  href={`/planner/trips/${tripId}/reviews`}
                  className="block px-4 py-2 text-[13.5px] text-ink-body hover:bg-border-soft"
                >
                  Reviews
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center overflow-x-auto px-5 sm:px-7">
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
        <span className="flex items-center px-3 py-2 text-[13.5px] text-faint" title="Coming soon">
          Notes
        </span>

        <div className="ml-auto flex flex-none items-center gap-3 pl-3">
          <Link
            href={`/planner/trips/${tripId}/convergence`}
            className="whitespace-nowrap py-2 text-[13px] text-muted hover:text-ink"
          >
            Where we landed
          </Link>
          <div className="h-4 w-px bg-border" />
          <span title="Splitwise (coming soon)" className="text-muted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12h8M8 9h5M11 15h5" />
            </svg>
          </span>
          <span title="iCloud calendar (coming soon)" className="text-muted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.3-2A5 5 0 0 0 6.5 19h11Z" />
            </svg>
          </span>
        </div>
      </div>
    </header>
  );
}
