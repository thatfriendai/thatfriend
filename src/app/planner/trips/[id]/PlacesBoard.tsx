"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { KIND_OPTIONS } from "@/lib/planner/itinerary";
import { AddPlaceModal } from "./AddPlaceModal";
import { PlaceMapView } from "@/components/planner/PlaceMapView";
import { PlaceKindTile } from "@/components/planner/PlaceKindIcon";
import type { PlannerDay, PlannerPlace } from "@/lib/supabase/planner-types";

type PlaceWithWho = PlannerPlace & { who: string; sourceLabel: string | null };

export function PlacesBoard({
  tripId,
  days,
  places: initialPlaces,
  googleMapsApiKey,
}: {
  tripId: string;
  days: PlannerDay[];
  places: PlaceWithWho[];
  googleMapsApiKey: string;
}) {
  const [places, setPlaces] = useState(initialPlaces);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // The top bar's "+ Add" dropdown jumps here with ?openAdd=place|link and
  // this section opens its own modal in response, rather than the top bar
  // owning a duplicate copy of this modal's state. Adjusting state during
  // render (not in an effect) so this only fires once per actual param
  // change — see https://react.dev/learn/you-might-not-need-an-effect.
  const searchParams = useSearchParams();
  const openAddParam = searchParams.get("openAdd");
  const [handledOpenAdd, setHandledOpenAdd] = useState<string | null>(null);
  if (openAddParam && openAddParam !== handledOpenAdd) {
    setHandledOpenAdd(openAddParam);
    if (openAddParam === "place" || openAddParam === "link") setAddOpen(true);
  }

  async function removePlace(id: string) {
    setRemovingId(id);
    const res = await fetch(`/api/v2/trips/${tripId}/places/${id}`, { method: "DELETE" });
    setRemovingId(null);
    if (!res.ok) return;
    setPlaces((list) => list.filter((p) => p.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }

  const groups = KIND_OPTIONS.map((k) => ({
    ...k,
    places: places.filter((p) => p.kind === k.kind),
  })).filter((g) => g.places.length > 0);

  const selected = places.find((p) => p.id === selectedId) ?? null;

  return (
    <div id="places">
      <div className="mb-4.5 flex items-baseline gap-3.5 border-b border-border pb-3">
        <div className="font-mono text-[11px] text-faint">04</div>
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
        <div className="mb-10 grid grid-cols-1 overflow-hidden rounded-2xl border border-border lg:h-[460px] lg:[grid-template-columns:minmax(340px,1fr)_minmax(300px,0.95fr)]">
          <div className="order-2 max-h-[420px] overflow-y-auto bg-[#FBF9F3] px-2.5 py-4 pb-6 lg:order-1 lg:max-h-none">
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
                            <div className="mt-1 text-[13.5px] leading-[1.5] text-body">
                              {p.note}
                            </div>
                          )}
                          <div className="mt-1.5 flex items-baseline gap-2 font-mono text-[10.5px] text-muted">
                            {p.sourceLabel && (
                              <a
                                href="#resources"
                                onClick={(e) => e.stopPropagation()}
                                className="text-faint hover:text-accent"
                              >
                                {p.sourceLabel}
                              </a>
                            )}
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
          </div>

          <div className="relative order-1 h-[220px] border-b border-border lg:order-2 lg:h-auto lg:border-b-0 lg:border-l">
            <PlaceMapView
              apiKey={googleMapsApiKey}
              places={places}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {selected && (
              <div className="absolute top-3 right-3 left-3 rounded-[10px] border border-border bg-card px-3.5 py-2.5">
                <div className="text-[13.5px] text-[#2B2825]">{selected.name}</div>
                <div className="mt-1 mb-2.5 font-mono text-[10px] text-muted">
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
            )}
          </div>
        </div>
      )}

      <AddPlaceModal
        tripId={tripId}
        days={days}
        googleMapsApiKey={googleMapsApiKey}
        existingPlaces={places}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(place) =>
          setPlaces((list) => [...list, { ...place, who: "You" }])
        }
      />
    </div>
  );
}
