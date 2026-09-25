import { describe, expect, it } from "vitest";
import {
  MAX_TRIP_DAYS,
  MAX_TRIP_NAME_LENGTH,
  MAX_AVAILABILITY_MARKS,
  MAX_PLACES_PER_CONFIRM,
  MAX_OPTIONS_PER_DECISION,
  MAX_TRAVELERS_PER_TRIP,
  MAX_STAYS_PER_TRIP,
} from "@/config/limits";
import { joinTripById } from "@/lib/planner/smsTripStart";

describe("config/limits — every cap lives here, nowhere else", () => {
  it("has the values agreed in docs/qa/KNOWN_ISSUES.md", () => {
    expect(MAX_TRIP_DAYS).toBe(60);
    expect(MAX_TRIP_NAME_LENGTH).toBe(120);
    expect(MAX_AVAILABILITY_MARKS).toBe(366);
    expect(MAX_PLACES_PER_CONFIRM).toBe(12);
    expect(MAX_OPTIONS_PER_DECISION).toBe(10);
    expect(MAX_TRAVELERS_PER_TRIP).toBe(30);
    expect(MAX_STAYS_PER_TRIP).toBe(10);
  });
});

describe("joinTripById — traveler cap", () => {
  // A minimal fake admin covering exactly the query shape joinTripById
  // makes: trip lookup, existing-membership check, a member count, insert.
  function fakeAdmin(memberCount: number) {
    const inserted: unknown[] = [];
    const admin = {
      from: (table: string) => ({
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          const builder = {
            eq: () => builder,
            maybeSingle: async () => {
              if (table === "planner_trips") {
                return { data: { id: "trip1", name: "Big Reunion", twilio_conversation_sid: null } };
              }
              if (table === "planner_memberships") return { data: null }; // not already a member
              return { data: null };
            },
            then: (resolve: (v: { count: number | null }) => void) => {
              // Only the count query awaits the builder itself, not .maybeSingle().
              resolve({ count: opts?.count ? memberCount : null });
            },
          };
          return builder;
        },
        insert: async (value: unknown) => {
          inserted.push(value);
          return { error: null };
        },
      }),
    };
    return { admin: admin as never, inserted };
  }

  it("blocks joining a trip already at the cap, with a specific message", async () => {
    const { admin, inserted } = fakeAdmin(MAX_TRAVELERS_PER_TRIP);
    const result = await joinTripById(admin, { id: "u1", phone: null }, "trip1");
    expect(result).toEqual({
      outcome: "error",
      error: `This trip is already at its limit of ${MAX_TRAVELERS_PER_TRIP} travelers.`,
    });
    expect(inserted).toEqual([]);
  });

  it("still allows joining one under the cap", async () => {
    const { admin, inserted } = fakeAdmin(MAX_TRAVELERS_PER_TRIP - 1);
    const result = await joinTripById(admin, { id: "u1", phone: null }, "trip1");
    expect(result.outcome).toBe("joined");
    expect(inserted).toHaveLength(1);
  });
});
