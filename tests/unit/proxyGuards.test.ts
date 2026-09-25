import { describe, expect, it } from "vitest";
import {
  matchTripPagePath,
  matchTripSubRoutePath,
  matchTripDecisionPath,
  matchProfilePath,
  matchSharePath,
  matchPlannerJoinPath,
  matchJoinLinkPath,
} from "@/lib/planner/proxyGuards";

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

describe("matchTripSubRoutePath", () => {
  it.each(["preferences", "dates", "convergence", "reviews"])("matches /planner/trips/{id}/%s", (segment) => {
    expect(matchTripSubRoutePath(`/planner/trips/abc-123/${segment}`)).toBe("abc-123");
  });

  it("doesn't match the trip page itself or an unrelated sub-route", () => {
    expect(matchTripSubRoutePath("/planner/trips/abc-123")).toBe(null);
    expect(matchTripSubRoutePath("/planner/trips/abc-123/decisions/xyz")).toBe(null);
  });
});

describe("matchTripDecisionPath", () => {
  it("matches both params", () => {
    expect(matchTripDecisionPath("/planner/trips/abc-123/decisions/xyz-789")).toEqual({
      tripId: "abc-123",
      decisionId: "xyz-789",
    });
  });

  it("doesn't match a bare decisions list or a deeper path", () => {
    expect(matchTripDecisionPath("/planner/trips/abc-123/decisions")).toBe(null);
    expect(matchTripDecisionPath("/planner/trips/abc-123/decisions/xyz/extra")).toBe(null);
  });
});

describe("matchProfilePath", () => {
  it("matches a username", () => {
    expect(matchProfilePath("/planner/u/maya")).toBe("maya");
  });

  it("doesn't match a nested path", () => {
    expect(matchProfilePath("/planner/u/maya/settings")).toBe(null);
  });
});

describe("matchSharePath", () => {
  it("matches a share token", () => {
    expect(matchSharePath("/planner/share/abc123")).toBe("abc123");
  });

  it("doesn't match without a token", () => {
    expect(matchSharePath("/planner/share")).toBe(null);
  });
});

describe("matchPlannerJoinPath", () => {
  it("matches a bare token", () => {
    expect(matchPlannerJoinPath("/planner/join/abc123")).toBe("abc123");
  });

  it("takes the last segment when a slug prefixes the token", () => {
    expect(matchPlannerJoinPath("/planner/join/lisbon/abc123")).toBe("abc123");
  });

  it("doesn't match an unrelated path", () => {
    expect(matchPlannerJoinPath("/j/abc123")).toBe(null);
  });
});
