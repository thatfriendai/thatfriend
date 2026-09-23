import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/planner/slug";
import { generateJoinCode, generateToken } from "@/lib/planner/tokens";
import { isGoogleMapsUrl } from "@/lib/planner/mapsLink";
import { deriveLabelFromUrl } from "@/lib/planner/fetchPage";
import { countryFromAddress, cityFromAddress } from "@/lib/planner/countries";
import { TRIPS } from "../../qa/fixtures";

describe("slugify", () => {
  it.each([
    ["Istanbul", "istanbul"],
    ["Mexico City, Mexico", "mexico-city"],
    ["São Paulo, Brazil", "sao-paulo"],
    ["Zürich", "zurich"],
    ["Kraków, Poland", "krakow"],
    ["東京", "trip"],
    ["", "trip"],
    ["   ", "trip"],
  ])("%j -> %s", (input, slug) => {
    expect(slugify(input)).toBe(slug);
  });

  it("maps the dotted capital İ to plain i (Turkish destinations)", () => {
    expect(slugify(TRIPS.accented.destination)).toBe("istanbul");
  });

  it("caps length and never ends in a dash", () => {
    const slug = slugify("Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch Village");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("tokens", () => {
  it("invite tokens are URL-safe and unique", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it.each([
    ["Lisbon, Portugal", /^LISBON[A-Z2-9]{3}$/],
    ["İstanbul, Türkiye", /^STANBUL[A-Z2-9]{3}$|^ISTANBUL[A-Z2-9]{3}$/],
    [null, /^TRIP[A-Z2-9]{3}$/],
    ["東京", /^TRIP[A-Z2-9]{3}$/],
  ])("join code for %j is textable", (destination, pattern) => {
    const code = generateJoinCode(destination);
    expect(code).toMatch(pattern);
    expect(code).not.toMatch(/[01OIL](?=[A-Z2-9]{0,2}$)/);
  });
});

describe("links", () => {
  it.each([
    "https://maps.app.goo.gl/abc123",
    "https://goo.gl/maps/xyz",
    "https://www.google.com/maps/place/Time+Out+Market",
    "https://www.google.co.uk/maps/@51.5,-0.1,15z",
  ])("recognizes %s as a Maps link", (url) => expect(isGoogleMapsUrl(url)).toBe(true));

  it.each(["https://www.tiktok.com/@x/video/1", "https://maps.apple.com/?q=x", null, undefined, ""])(
    "does not treat %s as a Google Maps link",
    (url) => expect(isGoogleMapsUrl(url)).toBe(false)
  );

  it("de-slugs an article URL into a readable label", () => {
    expect(deriveLabelFromUrl("https://www.forbes.com/sites/x/2026/best-bars-in-lisbon-right-now/")).toBe(
      "Best Bars In Lisbon Right Now"
    );
    expect(deriveLabelFromUrl("https://example.com/12345")).toBe("https://example.com/12345");
    expect(deriveLabelFromUrl("not a url")).toBe("not a url");
    expect(() => deriveLabelFromUrl("https://example.com/%E0%A4%A")).not.toThrow();
  });
});

describe("countries from Google addresses", () => {
  it.each([
    ["Rua da Prata 80, 1100-414 Lisboa, Portugal", "Portugal", "Lisboa"],
    ["123 Congress Ave, Austin, TX 78701, USA", "United States", "Austin"],
    ["Beyoğlu, 34430 İstanbul, Türkiye", "Türkiye", "İstanbul"],
    ["10 Downing St, London SW1A 2AA, UK", "United Kingdom", "London"],
    ["Av. Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200, Brazil", "Brazil", "São Paulo - SP"],
  ])("%s", (address, country, city) => {
    expect(countryFromAddress(address)?.name).toBe(country);
    expect(cityFromAddress(address)).toBe(city);
  });

  it("returns null for missing or unrecognized addresses", () => {
    expect(countryFromAddress(null)).toBeNull();
    expect(countryFromAddress("Somewhere, Atlantis")).toBeNull();
    expect(cityFromAddress("")).toBeNull();
  });
});
