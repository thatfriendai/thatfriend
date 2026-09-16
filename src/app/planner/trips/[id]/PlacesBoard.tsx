"use client";

import { useEffect, useState } from "react";
import { KIND_OPTIONS } from "@/lib/planner/itinerary";
import { AddPlaceModal } from "./AddPlaceModal";
import { PlaceMapView } from "@/components/planner/PlaceMapView";
import { PlaceKindTile } from "@/components/planner/PlaceKindIcon";
import type { PlannerDay, PlannerPlace, PlaceKind } from "@/lib/supabase/planner-types";

type PlaceWithWho = PlannerPlace & { who: string };

const MINE_FILTER = "__mine__";

export function PlacesBoard({
  tripId,
  days,
  places: initialPlaces,
  googleMapsApiKey,
  myDisplayName,
}: {
  tripId: string;
  days: PlannerDay[];
  places: PlaceWithWho[];
  googleMapsApiKey: string;
  myDisplayName: string;
}) {
  const [places, setPlaces] = useState(initialPlaces);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addEntryMode, setAddEntryMode] = useState<"place" | "resource">("place");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  function toggleFilter(f: string) {
    setSelectedId(null);
    setActiveFilters((list) => (list.includes(f) ? list.filter((x) => x !== f) : [...list, f]));
  }
  function clearFilters() {
    setSelectedId(null);
    setActiveFilters([]);
  }

  // The top bar's "+ Add" dropdown dispatches this instead of navigating,
  // so opening the modal doesn't wait on a full page re-fetch.
  useEffect(() => {
    function handler(e: Event) {
      const kind = (e as CustomEvent<{ kind: string }>).detail?.kind;
      if (kind === "place" || kind === "resource") {
        setAddEntryMode(kind);
        setAddOpen(true);
      }
    }
    window.addEventListener("open-add-modal", handler);
    return () => window.removeEventListener("open-add-modal", handler);
  }, []);

  async function removePlace(id: string) {
    setRemovingId(id);
    const res = await fetch(`/api/v2/trips/${tripId}/places/${id}`, { method: "DELETE" });
    setRemovingId(null);
    if (!res.ok) return;
    setPlaces((list) => list.filter((p) => p.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }

  const activeKinds = activeFilters.filter((f) => f !== MINE_FILTER) as PlaceKind[];
  const mineOnly = activeFilters.includes(MINE_FILTER);
  const visible = places.filter(
    (p) => (activeKinds.length === 0 || activeKinds.includes(p.kind)) && (!mineOnly || p.who === myDisplayName)
  );

  const groups = KIND_OPTIONS.map((k) => ({
    ...k,
    places: visible.filter((p) => p.kind === k.kind),
  })).filter((g) => g.places.length > 0);

  const selected = visible.find((p) => p.id === selectedId) ?? null;
  const isFiltered = activeFilters.length > 0;

  return (
    <div id="places">
      <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
        <div className="font-mono text-[11px] text-faint">03</div>
        <div className="font-display text-[25px] text-ink">Places to save</div>
        <div className="ml-auto flex items-center gap-3.5">
          <div className="text-[13.5px] text-muted">Click a place to find it on the map</div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-[13.5px] text-cream hover:bg-accent"
          >
            <span className="text-[15px] leading-none">+</span> Add a place
          </button>
        </div>
      </div>

      {places.length === 0 ? (
        <div className="mb-10 rounded-2xl border border-dashed border-input-border p-7 text-center">
          <p className="mb-1.5 font-display text-xl text-ink">Nothing saved yet</p>
          <p className="text-[15px] text-body">
            Restaurants, bars, museums, whatever&rsquo;s worth remembering.
          </p>
        </div>
      ) : (
        <div className="mb-10 overflow-hidden rounded-2xl border border-border">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-[#FBF9F3] px-4 py-3">
            {KIND_OPTIONS.filter((k) => places.some((p) => p.kind === k.kind)).map((k) => (
              <button
                key={k.kind}
                type="button"
                onClick={() => toggleFilter(k.kind)}
                className="rounded-full border px-3 py-1.5 text-[14px] transition-colors"
                style={{
                  borderColor: activeKinds.includes(k.kind) ? "#1B1917" : "var(--color-input-border)",
                  background: activeKinds.includes(k.kind) ? "#1B1917" : "var(--color-card)",
                  color: activeKinds.includes(k.kind) ? "var(--color-cream)" : "var(--color-ink-body)",
                }}
              >
                {k.kind}
              </button>
            ))}
            <button
              type="button"
              onClick={() => toggleFilter(MINE_FILTER)}
              className="rounded-full border px-3 py-1.5 text-[14px] transition-colors"
              style={{
                borderColor: mineOnly ? "#1B1917" : "var(--color-input-border)",
                background: mineOnly ? "#1B1917" : "var(--color-card)",
                color: mineOnly ? "var(--color-cream)" : "var(--color-ink-body)",
              }}
            >
              Added by me
            </button>
            {isFiltered && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto text-[14px] text-accent underline underline-offset-[3px]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:h-[460px] lg:[grid-template-columns:minmax(340px,1fr)_minmax(300px,0.95fr)]">
          <div className="order-2 max-h-[420px] overflow-y-auto bg-[#FBF9F3] px-2.5 py-4 pb-6 lg:order-1 lg:max-h-none">
            {visible.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="mb-1 text-[16px] text-[#4A453E]">Nothing matches those filters</p>
                <p className="mb-4 text-[14.5px] text-muted">Clear the filter, or add one from a link</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-full border border-input-border px-4 py-2 text-[14.5px] text-ink-body hover:border-ink"
                >
                  Clear filters
                </button>
              </div>
            ) : (
            <div className="flex flex-col gap-5.5">
              {groups.map((g) => (
                <div key={g.kind}>
                  <div className="mb-1 flex items-center gap-2 border-b border-[#EDE8DD] px-1 pb-2">
                    <div
                      className="h-2.5 w-2.5 flex-none rounded-[3px]"
                      style={{ background: g.color }}
                    />
                    <div className="font-mono text-[10.5px] tracking-[0.12em] text-[#6B655C] uppercase">
                      {g.kind}
                    </div>
                    <div className="ml-auto text-xs text-muted">{g.places.length} saved</div>
                  </div>
                  {g.places.map((p) => {
                    const on = p.id === selectedId;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className="flex cursor-pointer gap-3 rounded-xl px-3.5 py-3 transition-all"
                        style={{
                          background: on ? "#FFFDF9" : "transparent",
                          border: `1px solid ${on ? "#DDD6C8" : "transparent"}`,
                          boxShadow: on ? "0 1px 3px rgba(27,25,23,0.06)" : "none",
                        }}
                      >
                        {p.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.photo_url}
                            alt=""
                            width={54}
                            height={54}
                            className="h-[54px] w-[54px] flex-none rounded-lg border border-border-soft object-cover"
                          />
                        ) : (
                          <PlaceKindTile kind={p.kind} size={54} />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] font-medium text-[#2B2825]">{p.name}</div>
                          {p.note && (
                            <div className="mt-0.5 line-clamp-1 text-[14.5px] text-body">{p.note}</div>
                          )}
                          <div className="mt-1.5 font-mono text-[10.5px] text-muted">
                            <span>added by {p.who}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePlace(p.id);
                          }}
                          disabled={removingId === p.id}
                          aria-label={`Remove ${p.name}`}
                          className="flex h-6 w-6 flex-none items-center justify-center self-start rounded-full text-[15px] leading-none text-faint hover:bg-[#F2EEE5] hover:text-red-700 disabled:opacity-40"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            )}
          </div>

          <div className="relative order-1 h-[220px] border-b border-border lg:order-2 lg:h-auto lg:border-b-0 lg:border-l">
            <PlaceMapView
              apiKey={googleMapsApiKey}
              places={visible}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {selected && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="absolute top-3 right-3 z-10 rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[13.5px] text-ink-body hover:border-ink"
                >
                  Show all
                </button>
                <div className="absolute right-3 bottom-3 left-3 rounded-[10px] border border-border bg-card px-3.5 py-2.5">
                  <div className="text-[13.5px] text-[#2B2825]">{selected.name}</div>
                  {selected.note && (
                    <div className="mt-0.5 line-clamp-1 text-[13.5px] text-body">{selected.note}</div>
                  )}
                  <div className="mt-1 mb-2.5 font-mono text-[10.5px] text-muted">
                    added by {selected.who}
                  </div>
                  <div className="flex flex-wrap gap-3.5 border-t border-[#EDE8DD] pt-2.5">
                    {KIND_OPTIONS.map((k) => (
                      <div key={k.kind} className="flex items-center gap-1.5 text-xs text-[#6B655C]">
                        <span
                          className="h-2 w-2 rounded-[2px]"
                          style={{ background: k.color }}
                        />
                        <span>{k.kind}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          </div>
        </div>
      )}

      <AddPlaceModal
        tripId={tripId}
        days={days}
        googleMapsApiKey={googleMapsApiKey}
        existingPlaces={places}
        open={addOpen}
        entryMode={addEntryMode}
        onClose={() => setAddOpen(false)}
        onCreated={(place) => setPlaces((list) => [...list, { ...place, who: myDisplayName }])}
      />
    </div>
  );
}
