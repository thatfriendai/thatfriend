import "server-only";
import { addDays, todayIn } from "./calendarDate";

/**
 * The one-line forecast on each itinerary day — "24° sunny · sunset 19:32".
 * Open-Meteo: free, no key, 16 days out. Days further away than that, or a
 * destination it can't place, simply get no line; this is a nice-to-have
 * and must never fail the page it's on.
 */

const FORECAST_DAYS = 16;

// A fresh timeout per request — one signal shared at module level would already be spent.
const opts = () => ({ next: { revalidate: 3600 }, signal: AbortSignal.timeout(3000) });

// WMO weather codes, collapsed to the words someone planning a day uses.
function describe(code: number, rainChance: number | null): string {
  if (code >= 95) return "thunderstorms";
  if (code >= 80) return "showers";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 61) return rainChance !== null && rainChance >= 70 ? "rain most of the day" : "rain";
  if (code >= 51) return "drizzle";
  if (code === 45 || code === 48) return "fog";
  if (code === 3) return "cloudy";
  if (code === 2) return "partly cloudy";
  return "sunny";
}

async function locate(place: string): Promise<{ lat: number; lng: number; us: boolean } | null> {
  // "Lisbon, Portugal" → "Lisbon": the geocoder matches place names, not addresses.
  const [namePart, ...rest] = place.split(",");
  const name = namePart.trim();
  if (!name) return null;
  // Whatever followed the first comma ("Maine", "Portugal") — used below to
  // pick the right same-named city out of several candidates, e.g. so
  // "Portland, Maine" doesn't silently resolve to Portland, OR.
  const qualifier = rest.join(",").trim().toLowerCase();
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=${qualifier ? 10 : 1}`,
      opts()
    );
    const results = (await res.json())?.results as
      | { latitude: number; longitude: number; country_code: string; admin1?: string; country?: string }[]
      | undefined;
    if (!results?.length) return null;
    const hit =
      (qualifier &&
        results.find(
          (r) =>
            (r.admin1 && qualifier.includes(r.admin1.toLowerCase())) ||
            (r.country && qualifier.includes(r.country.toLowerCase()))
        )) ||
      results[0];
    return { lat: hit.latitude, lng: hit.longitude, us: hit.country_code === "US" };
  } catch {
    return null;
  }
}

/** Forecast lines keyed by ISO date, for whichever of `days` fall inside the forecast window. */
export async function forecastForDays(
  days: { date: string; city: string | null }[],
  destination: string | null
): Promise<Record<string, string>> {
  // Calendar-date math, not instants: `toISOString()` is UTC, which drops
  // "today" from the window for anyone west of UTC late in the evening.
  // A day of slack before today covers the server's clock being ahead of
  // the destination's (Open-Meteo still returns yesterday with timezone=auto).
  const today = addDays(todayIn(), -1);
  const horizon = addDays(todayIn(), FORECAST_DAYS - 1);
  const inRange = days.filter((d) => d.date >= today && d.date <= horizon);
  if (inRange.length === 0) return {};

  // A two-city trip gets each city's own weather; days without a city use the destination.
  const byPlace = new Map<string, string[]>();
  for (const d of inRange) {
    const place = d.city || destination;
    if (!place) continue;
    byPlace.set(place, [...(byPlace.get(place) ?? []), d.date]);
  }

  const out: Record<string, string> = {};
  await Promise.all(
    [...byPlace.entries()].map(async ([place, dates]) => {
      const loc = await locate(place);
      if (!loc) return;
      const sorted = [...dates].sort();
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}` +
        `&daily=weather_code,temperature_2m_max,precipitation_probability_max,sunset&timezone=auto` +
        `&start_date=${sorted[0]}&end_date=${sorted[sorted.length - 1]}` +
        (loc.us ? "&temperature_unit=fahrenheit" : "");
      try {
        const daily = (await (await fetch(url, opts())).json())?.daily;
        if (!daily?.time) return;
        daily.time.forEach((date: string, i: number) => {
          if (!dates.includes(date)) return;
          const temp = daily.temperature_2m_max?.[i];
          const code = daily.weather_code?.[i];
          if (temp == null || code == null) return;
          const sunset: string | undefined = daily.sunset?.[i]?.slice(11, 16);
          const sunsetLabel = sunset
            ? loc.us
              ? new Date(`${date}T${sunset}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "")
              : sunset
            : null;
          out[date] = [`${Math.round(temp)}° ${describe(code, daily.precipitation_probability_max?.[i] ?? null)}`, sunsetLabel && `sunset ${sunsetLabel}`]
            .filter(Boolean)
            .join(" · ");
        });
      } catch {
        // No line for these days.
      }
    })
  );
  return out;
}
