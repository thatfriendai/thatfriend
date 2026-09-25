import { describe, expect, it } from "vitest";
import { cooldownRemainingMs, formatRelativeTime } from "@/lib/planner/nudgeCooldown";

describe("cooldownRemainingMs (P2-7: nudge cooldown)", () => {
  it("is 0 when nothing's ever been sent", () => {
    expect(cooldownRemainingMs(null, 24)).toBe(0);
  });

  it("is 0 once the cooldown window has fully passed", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const sentAt = new Date("2026-10-09T00:00:00Z").toISOString(); // 36h ago
    expect(cooldownRemainingMs(sentAt, 24, now)).toBe(0);
  });

  it("is the remaining milliseconds while still inside the window", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const sentAt = new Date("2026-10-10T00:00:00Z").toISOString(); // 12h ago
    // 24h cooldown, 12h elapsed → 12h left
    expect(cooldownRemainingMs(sentAt, 24, now)).toBe(12 * 60 * 60 * 1000);
  });

  it("never goes negative for a sent_at somehow in the future", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const sentAt = new Date("2026-10-11T00:00:00Z").toISOString();
    expect(cooldownRemainingMs(sentAt, 24, now)).toBeGreaterThanOrEqual(0);
  });
});

describe("formatRelativeTime", () => {
  it("says 'just now' under a minute", () => {
    const now = new Date("2026-10-10T12:00:20Z");
    expect(formatRelativeTime("2026-10-10T12:00:00Z", now)).toBe("just now");
  });

  it("shows minutes under an hour", () => {
    const now = new Date("2026-10-10T12:45:00Z");
    expect(formatRelativeTime("2026-10-10T12:00:00Z", now)).toBe("45m ago");
  });

  it("shows hours under a day", () => {
    const now = new Date("2026-10-10T15:00:00Z");
    expect(formatRelativeTime("2026-10-10T12:00:00Z", now)).toBe("3h ago");
  });

  it("shows days at 24h and beyond", () => {
    const now = new Date("2026-10-12T12:00:00Z");
    expect(formatRelativeTime("2026-10-10T12:00:00Z", now)).toBe("2d ago");
  });
});
