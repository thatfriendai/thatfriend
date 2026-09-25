import { describe, expect, it } from "vitest";
import { matchTripPagePath, matchJoinLinkPath } from "@/lib/planner/proxyGuards";

describe("matchTripPagePath", () => {
  it("matches the exact trip page", () => {
    expect(matchTripPagePath("/planner/trips/abc-123")).toBe("abc-123");
  });

  it("doesn't match the new-trip route", () => {
    expect(matchTripPagePath("/planner/trips/new")).toBe(null);
  });

  it("doesn't match a nested sub-route", () => {
    expect(matchTripPagePath("/planner/trips/abc-123/dates")).toBe(null);
    expect(matchTripPagePath("/planner/trips/abc-123/decisions/xyz")).toBe(null);
  });

  it("doesn't match the trips list", () => {
    expect(matchTripPagePath("/planner/trips")).toBe(null);
  });
});

describe("matchJoinLinkPath", () => {
  it("matches a bare token", () => {
    expect(matchJoinLinkPath("/j/abc123")).toBe("abc123");
  });

  it("takes the last segment when a slug prefixes the token", () => {
    expect(matchJoinLinkPath("/j/lisbon/abc123")).toBe("abc123");
  });

  it("doesn't match an unrelated path", () => {
    expect(matchJoinLinkPath("/planner/join/abc123")).toBe(null);
  });
});
