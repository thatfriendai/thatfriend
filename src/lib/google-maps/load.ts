"use client";

import { importLibrary, setOptions, type LibraryMap } from "@googlemaps/js-api-loader";

let configured = false;

export function loadGoogleMapsLibrary<TLibraryName extends keyof LibraryMap>(
  apiKey: string,
  library: TLibraryName
): Promise<LibraryMap[TLibraryName]> {
  if (!configured) {
    setOptions({ key: apiKey, v: "weekly" });
    configured = true;
  }
  return importLibrary(library);
}
