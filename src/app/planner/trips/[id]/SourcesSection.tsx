"use client";

import { useState } from "react";
import { ResourceTile } from "@/components/planner/ResourceIcon";
import type { ResourceType } from "@/lib/supabase/planner-types";

export interface SourceRow {
  id: string;
  type: ResourceType;
  label: string;
  who: string;
  count: number;
  source_url: string | null;
}

const COLLAPSED_COUNT = 6;

export function SourcesSection({ resources }: { resources: SourceRow[] }) {
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? resources : resources.slice(0, COLLAPSED_COUNT);
  const hiddenCount = resources.length - visible.length;

  return (
    <div id="resources" className="mb-14 max-w-[760px]">
      <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
        <span className="font-mono text-[11px] text-faint">06</span>
        <span className="text-[25px] font-display text-ink">Resources</span>
        <span className="ml-auto text-[13.5px] text-muted">Links, videos, and notes worth keeping around</span>
      </div>

      {resources.length === 0 ? (
        <p className="text-[14.5px] text-muted">
          Nothing here yet — paste a YouTube link or article from +Add → A link. If it doesn&rsquo;t name a
          specific place, it lands here automatically.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((r) => {
            const RowTag = r.source_url ? "a" : "div";
            return (
              <RowTag
                key={r.id}
                {...(r.source_url ? { href: r.source_url, target: "_blank", rel: "noopener noreferrer" } : {})}
                className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-3.5 py-3 hover:border-input-border"
              >
                <ResourceTile type={r.type} sourceUrl={r.source_url} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] text-[#2B2825]">{r.label}</div>
                  <div className="mt-0.5 truncate text-[12.5px] text-muted">
                    From {r.who}
                    {r.count > 1 ? ` · added ${r.count}×` : ""}
                  </div>
                </div>
                <div className="ml-auto flex-none rounded-full border border-border font-mono text-[10px] tracking-[0.08em] text-muted uppercase whitespace-nowrap px-2.5 py-1">
                  {r.type}
                </div>
              </RowTag>
            );
          })}
        </div>
      )}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2.5 w-full rounded-full border border-input-border bg-transparent px-4 py-2.5 text-[14px] text-body hover:border-ink"
        >
          Show all {resources.length}
        </button>
      )}
      {showAll && resources.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="mt-2.5 w-full rounded-full border border-input-border bg-transparent px-4 py-2.5 text-[14px] text-body hover:border-ink"
        >
          Show fewer
        </button>
      )}
    </div>
  );
}
