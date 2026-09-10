"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMapsLibrary } from "@/lib/google-maps/load";

// Trip destinations are cities, regions, or countries — not individual
// businesses or street addresses, so results are restricted to these
// primary types (Places API's max is 5 per element).
const DESTINATION_TYPES = ["locality", "administrative_area_level_1", "administrative_area_level_2", "country"];

/**
 * Google Places autocomplete for the "Where" field on a new trip. Free-text
 * typing still works (the caller keeps its own controlled `value`) — this
 * only offers real-place suggestions on top, and reports back a clean
 * "City, Country"-style label on selection.
 */
export function DestinationSearch({
  apiKey,
  value,
  onChange,
  placeholder,
}: {
  apiKey: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    loadGoogleMapsLibrary(apiKey, "places")
      .then(({ PlaceAutocompleteElement }) => {
        if (cancelled || !containerRef.current) return;

        const el = new PlaceAutocompleteElement({ includedPrimaryTypes: DESTINATION_TYPES });
        el.style.width = "100%";
        if (placeholder) el.placeholder = placeholder;
        containerRef.current.replaceChildren(el);
        elRef.current = el;
        setReady(true);

        el.addEventListener("gmp-select", async (event: Event) => {
          const { placePrediction } = event as unknown as {
            placePrediction: google.maps.places.PlacePrediction;
          };
          const place = placePrediction.toPlace();
          await place.fetchFields({ fields: ["formattedAddress", "displayName"] });
          onChangeRef.current(place.formattedAddress ?? place.displayName ?? "");
        });
        // Picking a suggestion is the common path, but typing a
        // destination that isn't in Google's results (or not picking one
        // at all) should still work — this keeps free text flowing
        // through to the parent's controlled value either way.
        el.addEventListener("input", () => onChangeRef.current(el.value ?? ""));
      })
      .catch(() => setReady(false));

    return () => {
      cancelled = true;
    };
  }, [apiKey, placeholder]);

  // The autocomplete element owns its own input value internally — this
  // keeps it in sync when the parent's value changes from elsewhere (e.g.
  // clearing the field), without fighting the element while the user types.
  useEffect(() => {
    if (elRef.current) elRef.current.value = value;
  }, [value, ready]);

  if (!apiKey) return null;

  return <div ref={containerRef} />;
}
