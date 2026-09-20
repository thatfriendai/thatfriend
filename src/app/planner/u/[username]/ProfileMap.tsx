"use client";

import { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";
import { kindColor } from "@/lib/planner/itinerary";
import type { TravelMap } from "@/lib/planner/travelMap";
import type { BackfilledCountry } from "@/lib/planner/backfillCountries";
import { POPULAR_BACKFILL_COUNTRIES } from "@/lib/planner/popularCountries";

const MAP_COLOR = {
  ocean: "#F6F1E7",
  land: "#E6E0D3",
  line: "#FFFDF9",
  her: "var(--color-accent)",
  faint: "#C8A7C1",
  both: "var(--color-positive)",
  mine: "#C08A3E",
  ink: "var(--color-ink)",
};

export interface LiveTrip {
  city: string;
  dayLabel: string;
  lat: number;
  lng: number;
}

interface PickedInfo {
  code: string;
  name: string;
  backfill: boolean;
  when: string | null;
  cities: string[];
  total: number;
  trips: { title: string; meta: string }[];
  places: { name: string; city: string | null; kind: string; rating: number }[];
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex-none whitespace-nowrap">
      <span className="font-display text-[22px] text-ink">{n}</span>
      <span className="ml-1.5 text-[13.5px] text-muted">{label}</span>
    </div>
  );
}

function Legend({ swatch, label, ring }: { swatch: string; label: string; ring?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {ring ? (
        <span className="h-2.5 w-2.5 flex-none rounded-full border-[1.2px] border-ink" style={{ background: "#FFFDF9" }} />
      ) : (
        <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: swatch }} />
      )}
      <span className="text-[13px] text-muted">{label}</span>
    </div>
  );
}

export function ProfileMap({
  isOwner,
  firstName,
  her,
  mine,
  live,
  backfilled,
  pins,
}: {
  isOwner: boolean;
  firstName: string;
  her: TravelMap;
  mine: { codes: string[] } | null;
  live: LiveTrip | null;
  backfilled: BackfilledCountry[];
  pins: { lat: number; lng: number }[];
}) {
  const [mode, setMode] = useState<"hers" | "overlap">("hers");
  const [picked, setPicked] = useState<string | null>(her.countries[0]?.code ?? backfilled[0]?.code ?? null);
  const [addedLocal, setAddedLocal] = useState<BackfilledCountry[]>([]);
  const [adding, setAdding] = useState(false);
  const [addId, setAddId] = useState("");
  const [addCities, setAddCities] = useState("");
  const [addWhen, setAddWhen] = useState("");
  const [saving, setSaving] = useState(false);

  const canCompare = !isOwner && mine !== null;
  const overlap = canCompare && mode === "overlap";

  const allBackfilled = useMemo(() => {
    const merged = new Map(backfilled.map((b) => [b.code, b] as const));
    for (const b of addedLocal) merged.set(b.code, b);
    return merged;
  }, [backfilled, addedLocal]);

  const ratedSet = useMemo(() => new Set(her.codes), [her.codes]);
  const backfilledSet = useMemo(() => new Set(allBackfilled.keys()), [allBackfilled]);
  const herAllCodes = useMemo(() => [...new Set([...ratedSet, ...backfilledSet])], [ratedSet, backfilledSet]);
  const herAllSet = useMemo(() => new Set(herAllCodes), [herAllCodes]);
  const mineSet = useMemo(() => new Set(mine?.codes ?? []), [mine]);

  const infoByCode = useMemo(() => {
    const map = new Map<string, PickedInfo>();
    for (const b of allBackfilled.values()) {
      map.set(b.code, { code: b.code, name: b.name, backfill: true, when: b.when, cities: b.cities, total: 0, trips: [], places: [] });
    }
    for (const c of her.countries) {
      map.set(c.code, { code: c.code, name: c.name, backfill: false, when: null, cities: c.cities, total: c.total, trips: c.trips, places: c.places });
    }
    return map;
  }, [her.countries, allBackfilled]);

  const regionByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of her.countries) map.set(c.code, c.region);
    for (const b of allBackfilled.values()) if (!map.has(b.code)) map.set(b.code, b.region);
    return map;
  }, [her.countries, allBackfilled]);
  const regionCount = useMemo(() => new Set(herAllCodes.map((c) => regionByCode.get(c)).filter(Boolean)).size, [herAllCodes, regionByCode]);

  const addOptions = useMemo(() => POPULAR_BACKFILL_COUNTRIES.filter((c) => !herAllSet.has(c.code)), [herAllSet]);

  const { features, path, projection } = useMemo(() => {
    const topo = worldTopo as unknown as Topology;
    const fc = feature(topo, topo.objects.countries) as GeoJSON.FeatureCollection;
    const feats = fc.features.filter((f) => String(f.id) !== "010");
    const collection: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: feats };
    const projection = geoNaturalEarth1().fitExtent(
      [
        [14, 10],
        [886, 458],
      ],
      collection
    );
    return { features: feats, path: geoPath(projection), projection };
  }, []);

  const livePoint = useMemo(() => (live ? projection([live.lng, live.lat]) : null), [projection, live]);
  const pinPoints = useMemo(
    () => pins.map((p) => projection([p.lng, p.lat])).filter((p): p is [number, number] => p !== null),
    [projection, pins]
  );

  const shared = herAllCodes.filter((c) => mineSet.has(c));
  const newToYou = herAllCodes.filter((c) => !mineSet.has(c));
  const mineAhead = (mine?.codes ?? []).filter((c) => !herAllSet.has(c));

  function fillFor(id: string) {
    if (!overlap) {
      if (ratedSet.has(id)) return MAP_COLOR.her;
      if (backfilledSet.has(id)) return MAP_COLOR.faint;
      return MAP_COLOR.land;
    }
    if (herAllSet.has(id) && mineSet.has(id)) return MAP_COLOR.both;
    if (herAllSet.has(id)) return MAP_COLOR.her;
    if (mineSet.has(id)) return MAP_COLOR.mine;
    return MAP_COLOR.land;
  }

  const pickedInfo = picked ? infoByCode.get(picked) : undefined;
  const bothHere = picked ? mineSet.has(picked) : false;
  const top = pickedInfo && !pickedInfo.backfill ? pickedInfo.places[0] : undefined;

  async function saveAdd() {
    if (!addId) return;
    setSaving(true);
    const res = await fetch("/api/v2/me/backfill-countries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country_code: addId,
        cities: addCities.split(",").map((c) => c.trim()).filter(Boolean),
        when: addWhen.trim() || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) return;
    const data: { country: BackfilledCountry } = await res.json();
    setAddedLocal((list) => [...list.filter((c) => c.code !== data.country.code), data.country]);
    setAdding(false);
    setAddId("");
    setAddCities("");
    setAddWhen("");
    setPicked(data.country.code);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {!isOwner && live && (
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border-soft bg-surface-warm px-5 py-3">
          <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: "var(--color-positive)" }} />
          <span className="min-w-[200px] flex-1 text-[14.5px] text-ink">
            {firstName} is in {live.city} right now
          </span>
          <span className="flex-none font-mono text-[10px] tracking-[0.1em] text-muted uppercase">{live.dayLabel}</span>
        </div>
      )}

      {(canCompare || isOwner) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border-soft px-5 py-3.5">
          {canCompare && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setMode("hers")}
                className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                  mode === "hers" ? "bg-ink text-cream" : "border border-input-border bg-card text-ink-soft"
                }`}
              >
                {firstName}&rsquo;s map
              </button>
              <button
                type="button"
                onClick={() => setMode("overlap")}
                className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                  mode === "overlap" ? "bg-ink text-cream" : "border border-input-border bg-card text-ink-soft"
                }`}
              >
                Overlap with you
              </button>
            </div>
          )}
          <span className="min-w-[160px] flex-1 text-right text-[13.5px] text-muted">
            {isOwner
              ? "Visitors see which of these they've been to too"
              : overlap
                ? `${shared.length} ${shared.length === 1 ? "country" : "countries"} in common · ${newToYou.length} you haven't been to`
                : "Tap any filled country"}
          </span>
          {isOwner && (
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className={`flex-none rounded-full px-3.5 py-1.5 text-[13px] ${
                adding ? "border border-input-border bg-card text-ink-soft" : "bg-ink text-cream"
              }`}
            >
              {adding ? "Cancel" : "Add somewhere you've been"}
            </button>
          )}
        </div>
      )}

      {isOwner && adding && (
        <div className="border-b border-border-soft bg-surface-warm px-5 py-4">
          <div className="mb-1 font-display text-[21px] leading-[1.2] text-ink">Add somewhere you&rsquo;ve been</div>
          <p className="mb-3.5 text-[13.5px] text-muted">
            Trips from before you joined won&rsquo;t have ratings, and that&rsquo;s fine. The country and the cities are what
            people look for.
          </p>

          {addOptions.length > 0 ? (
            <>
              <div className="mb-2 font-mono text-[9.5px] tracking-[0.1em] text-faint uppercase">Country</div>
              <div className="mb-3.5 flex flex-wrap gap-1.5">
                {addOptions.map((o) => (
                  <button
                    key={o.code}
                    type="button"
                    onClick={() => setAddId(o.code)}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] ${
                      addId === o.code ? "bg-accent text-on-accent" : "border border-input-border bg-card text-ink-soft"
                    }`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <label className="min-w-[220px] flex-[2]">
                  <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.1em] text-faint uppercase">Cities, comma separated</div>
                  <input
                    value={addCities}
                    onChange={(e) => setAddCities(e.target.value)}
                    placeholder="Rio de Janeiro, Paraty"
                    className="w-full rounded-[10px] border border-input-border bg-card px-3.5 py-2.5 text-[14.5px] text-ink outline-none focus:border-ink"
                  />
                </label>
                <label className="min-w-[140px] flex-1">
                  <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.1em] text-faint uppercase">When</div>
                  <input
                    value={addWhen}
                    onChange={(e) => setAddWhen(e.target.value)}
                    placeholder="2019"
                    className="w-full rounded-[10px] border border-input-border bg-card px-3.5 py-2.5 text-[14.5px] text-ink outline-none focus:border-ink"
                  />
                </label>
              </div>

              <div className="mt-3.5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveAdd}
                  disabled={!addId || saving}
                  className={`rounded-full px-4.5 py-2 text-[13.5px] disabled:cursor-not-allowed ${
                    addId ? "bg-accent text-on-accent" : "border border-input-border bg-transparent text-faint"
                  }`}
                >
                  {saving ? "Adding…" : "Add to map"}
                </button>
                <span className="text-[13px] text-muted">
                  {addedLocal.length > 0
                    ? `${addedLocal.length} ${addedLocal.length === 1 ? "country" : "countries"} added by hand`
                    : "Countries you travelled to before joining count too."}
                </span>
              </div>
            </>
          ) : (
            <p className="text-[13.5px] text-muted">Every suggested country is already on your map.</p>
          )}
        </div>
      )}

      <div className="px-5 pt-4 pb-5">
        <div className="mb-3.5 flex flex-wrap items-baseline gap-6">
          {overlap ? (
            <>
              <Stat n={shared.length} label="in common" />
              <Stat n={newToYou.length} label="new to you" />
              <Stat n={mineAhead.length} label="you're ahead" />
            </>
          ) : (
            <>
              <Stat n={herAllCodes.length} label={herAllCodes.length === 1 ? "country" : "countries"} />
              <Stat n={regionCount} label={regionCount === 1 ? "continent" : "continents"} />
              <Stat n={ratedSet.size} label="with ratings" />
            </>
          )}
        </div>

        <svg viewBox="0 0 900 468" className="block h-auto w-full rounded-xl" style={{ background: MAP_COLOR.ocean }}>
          <g>
            {features.map((f, i) => {
              const id = String(f.id);
              const hasData = infoByCode.has(id);
              return (
                <path
                  // World-atlas gives several disputed/unrecognized
                  // territories the placeholder id "-99" — index keeps
                  // those keys unique without affecting lookups by id.
                  key={`${id}-${i}`}
                  d={path(f) ?? undefined}
                  fill={fillFor(id)}
                  stroke={id === picked ? MAP_COLOR.ink : MAP_COLOR.line}
                  strokeWidth={id === picked ? 1.5 : 0.6}
                  style={{ cursor: hasData ? "pointer" : "default" }}
                  onClick={() => hasData && setPicked(id)}
                />
              );
            })}
          </g>
          <g>
            {pinPoints.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={3.2} fill="#FFFDF9" stroke={MAP_COLOR.ink} strokeWidth={1.1} />
            ))}
          </g>
          {livePoint && (
            <g transform={`translate(${livePoint[0]}, ${livePoint[1]})`}>
              <circle r={5} fill={MAP_COLOR.both} opacity={0.3} className="origin-center animate-[tfPulse_2.6s_ease-out_infinite]" />
              <circle r={4.4} fill={MAP_COLOR.both} stroke="#FFFDF9" strokeWidth={1.4} />
            </g>
          )}
        </svg>

        <div className="mt-3 flex flex-wrap items-center gap-4.5">
          {overlap ? (
            <>
              <Legend swatch={MAP_COLOR.both} label="Both of you" />
              <Legend swatch={MAP_COLOR.her} label={`${firstName} only`} />
              <Legend swatch={MAP_COLOR.mine} label="You only" />
            </>
          ) : (
            <>
              <Legend swatch={MAP_COLOR.her} label="Trips and ratings" />
              <Legend swatch={MAP_COLOR.faint} label={isOwner ? "Added by you, before That Friend" : "Been, before That Friend"} />
              <Legend swatch="" label="Cities with rated places" ring />
            </>
          )}
        </div>
      </div>

      {pickedInfo && (
        <div className="border-t border-border-soft bg-surface-warm px-5 py-4">
          <div className="mb-1 font-display text-[24px] leading-[1.15] text-ink">{pickedInfo.name}</div>
          <p className="mb-3 text-[14px] text-muted">
            {pickedInfo.backfill
              ? `${isOwner ? "Added by you" : "Before That Friend"} · ${pickedInfo.when}`
              : `${pickedInfo.total} ${pickedInfo.total === 1 ? "place rated" : "places rated"}${
                  pickedInfo.trips.length > 0
                    ? ` across ${pickedInfo.trips.length} ${pickedInfo.trips.length === 1 ? "trip" : "trips"}`
                    : ""
                }`}
          </p>

          {pickedInfo.cities.length > 0 && (
            <>
              <div className="mb-2 font-mono text-[9.5px] tracking-[0.1em] text-faint uppercase">
                {pickedInfo.cities.length === 1 ? "City" : `${pickedInfo.cities.length} cities`}
              </div>
              <div className="mb-3.5 flex flex-wrap gap-1.5">
                {pickedInfo.cities.map((c) => (
                  <span key={c} className="rounded-full border border-border-soft bg-card px-3 py-1 text-[13px] text-ink-soft">
                    {c}
                  </span>
                ))}
              </div>
            </>
          )}

          {top && (
            <div className="rounded-[11px] border border-border-soft bg-card px-3.5 py-2.5">
              <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.1em] text-faint uppercase">
                {pickedInfo.places.length > 1
                  ? isOwner
                    ? "Your highest rated"
                    : `${firstName}'s highest rated`
                  : "The only place rated here"}
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: kindColor(top.kind) }} />
                <span className="min-w-0 flex-1 text-[14.5px] leading-snug text-ink-body">{top.name}</span>
                {top.city && <span className="flex-none text-[13px] text-muted">{top.city}</span>}
                <span
                  className="flex-none font-mono text-[10px] tracking-[0.06em]"
                  style={{ color: top.rating >= 5 ? "var(--color-positive)" : "var(--color-muted)" }}
                >
                  {top.rating}/5
                </span>
              </div>
            </div>
          )}

          {pickedInfo.backfill && (
            <p className="rounded-[11px] border border-border-soft bg-card px-3.5 py-3 text-[13.5px] text-muted">
              {isOwner
                ? "Nothing rated here — you added this country from memory. Add a place if you remember one."
                : `Nothing rated here. ${firstName} added this country before joining.`}
            </p>
          )}

          {pickedInfo.trips.length > 0 && (
            <div className="mt-3 flex flex-col">
              {pickedInfo.trips.slice(0, 3).map((t) => (
                <a
                  key={t.title}
                  href="#trips"
                  className="flex items-baseline gap-2.5 border-t border-border-soft py-2.5 text-ink-body"
                >
                  <span className="min-w-0 flex-1 text-[14.5px] leading-snug">{t.title}</span>
                  <span className="flex-none text-[13px] text-muted">{t.meta}</span>
                  <span className="flex-none text-[13px] text-accent">→</span>
                </a>
              ))}
              {pickedInfo.trips.length > 3 && (
                <div className="border-t border-border-soft py-2.5 text-[13.5px] text-muted">
                  +{pickedInfo.trips.length - 3} more trips
                </div>
              )}
            </div>
          )}

          <div className="mt-3.5">
            <button
              type="button"
              onClick={() => {}}
              className={`rounded-full px-4 py-2 text-[13.5px] ${
                isOwner ? "border border-input-border bg-card text-ink-soft" : "bg-accent text-on-accent"
              }`}
            >
              {isOwner
                ? pickedInfo.backfill
                  ? `Add a place in ${pickedInfo.name}`
                  : "Edit these ratings"
                : pickedInfo.backfill
                  ? `Ask ${firstName} about ${pickedInfo.name} →`
                  : bothHere
                    ? "See what you both rated →"
                    : `Save ${firstName}'s ${pickedInfo.name} picks for later →`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
