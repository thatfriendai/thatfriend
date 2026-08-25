"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMapsLibrary } from "@/lib/google-maps/load";

export interface SelectedPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
}

export function PlaceSearch({
  apiKey,
  onSelect,
}: {
  apiKey: string;
  onSelect: (place: SelectedPlace) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) return;

    let cancelled = false;

    loadGoogleMapsLibrary(apiKey, "places")
      .then(({ PlaceAutocompleteElement }) => {
        if (cancelled || !containerRef.current) return;

        const el = new PlaceAutocompleteElement();
        el.style.width = "100%";
        containerRef.current.replaceChildren(el);

        el.addEventListener("gmp-select", async (event: Event) => {
          const { placePrediction } = event as unknown as {
            placePrediction: google.maps.places.PlacePrediction;
          };
          const place = placePrediction.toPlace();
          await place.fetchFields({
            fields: ["displayName", "formattedAddress", "location", "types"],
          });
          if (!place.location) return;

          onSelect({
            name: place.displayName ?? "Untitled place",
            address: place.formattedAddress ?? "",
            lat: place.location.lat(),
            lng: place.location.lng(),
            category: place.types?.[0] ?? "",
          });
        });
      })
      .catch(() => setError("Could not load Google Maps."));

    return () => {
      cancelled = true;
    };
  }, [apiKey, onSelect]);

  if (!apiKey) {
    return (
      <p className="text-sm text-red-700">
        Google Maps API key is not configured.
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  return <div ref={containerRef} />;
}
