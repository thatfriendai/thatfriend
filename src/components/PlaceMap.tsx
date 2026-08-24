"use client";

import { useCallback, useEffect, useRef } from "react";
import { loadGoogleMapsLibrary } from "@/lib/google-maps/load";
import type { Place } from "@/lib/supabase/types";

export function PlaceMap({
  apiKey,
  places,
}: {
  apiKey: string;
  places: Place[];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);

  const renderMarkers = useCallback(() => {
    if (!mapInstance.current) return;
    markers.current.forEach((m) => m.setMap(null));
    markers.current = places.map(
      (place) =>
        new google.maps.Marker({
          position: { lat: place.lat, lng: place.lng },
          map: mapInstance.current!,
          title: place.name,
        })
    );

    if (places.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      places.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      mapInstance.current.fitBounds(bounds);
    }
  }, [places]);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;
    let cancelled = false;

    loadGoogleMapsLibrary(apiKey, "maps").then(({ Map }) => {
      if (cancelled || !mapRef.current) return;
      mapInstance.current = new Map(mapRef.current, {
        center: places[0]
          ? { lat: places[0].lat, lng: places[0].lng }
          : { lat: 37.7749, lng: -122.4194 },
        zoom: places.length ? 11 : 3,
      });
      renderMarkers();
    });

    return () => {
      cancelled = true;
    };
    // Runs once per apiKey change to (re)create the map instance — places
    // updates are handled by the effect below via renderMarkers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  if (!apiKey) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Google Maps API key is not configured.
      </p>
    );
  }

  return (
    <div
      ref={mapRef}
      className="h-80 w-full rounded border border-zinc-200 dark:border-zinc-800"
    />
  );
}
