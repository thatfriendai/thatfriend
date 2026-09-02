"use client";

import { useCallback, useEffect, useRef } from "react";
import { loadGoogleMapsLibrary } from "@/lib/google-maps/load";
import { kindColor } from "@/lib/planner/itinerary";
import type { PlannerPlace } from "@/lib/supabase/planner-types";

type Geocoded = PlannerPlace & { lat: number; lng: number };

/**
 * Real Google Map with a marker per geocoded place, colored by kind. Places
 * without lat/lng (never geocoded, or the "can't find it" manual fallback)
 * are simply omitted from the map rather than shown at a fake position.
 */
export function PlaceMapView({
  apiKey,
  places,
  selectedId,
  onSelect,
}: {
  apiKey: string;
  places: PlannerPlace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const geocoded = places.filter((p): p is Geocoded => p.lat != null && p.lng != null);

  const renderMarkers = useCallback(() => {
    if (!mapInstance.current) return;
    markers.current.forEach((m) => m.setMap(null));
    markers.current = geocoded.map((place) => {
      const on = place.id === selectedId;
      const marker = new google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map: mapInstance.current!,
        title: place.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: on ? 10 : 7,
          fillColor: kindColor(place.kind),
          fillOpacity: on ? 1 : 0.75,
          strokeColor: "#FFFDF9",
          strokeWeight: 2,
        },
        zIndex: on ? 2 : 1,
      });
      marker.addListener("click", () => onSelectRef.current(place.id));
      return marker;
    });

    if (geocoded.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      geocoded.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      mapInstance.current.fitBounds(bounds, 40);
    }
  }, [geocoded, selectedId]);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;
    let cancelled = false;

    loadGoogleMapsLibrary(apiKey, "maps").then(({ Map }) => {
      if (cancelled || !mapRef.current) return;
      mapInstance.current = new Map(mapRef.current, {
        center: geocoded[0] ? { lat: geocoded[0].lat, lng: geocoded[0].lng } : { lat: 20, lng: 0 },
        zoom: geocoded.length ? 12 : 2,
        disableDefaultUI: true,
        zoomControl: true,
      });
      renderMarkers();
    });

    return () => {
      cancelled = true;
    };
    // Runs once per apiKey change to (re)create the map instance — place
    // updates are handled by the effect below via renderMarkers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  const missing = places.length - geocoded.length;

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center p-4 text-center text-sm text-red-700">
        Map is not configured.
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[220px] w-full">
      <div ref={mapRef} className="h-full w-full" />
      {missing > 0 && (
        <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] text-muted">
          {missing} place{missing === 1 ? "" : "s"} don&rsquo;t have a location yet
        </div>
      )}
    </div>
  );
}
