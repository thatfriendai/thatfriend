import { describe, expect, it, vi } from "vitest";

// Network-bound helpers pulled in at import time; none of the logic under
// test depends on what they do.
vi.mock("@/lib/twilio/conversations", () => ({
  addParticipantToConversation: vi.fn().mockResolvedValue(undefined),
  removeParticipantFromConversation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/planner/follows", () => ({ autoFriendTripMembers: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/planner/consent", () => ({ recordConsentEvent: vi.fn() }));

const { mayRejoinTrip, transferOwner } = await import("@/lib/planner/membership");
const { joinTripById, removedFromTripMessage } = await import("@/lib/planner/smsTripStart");
const { isInvitableEmail, emailInviteUsedBySomeoneElse } = await import("@/lib/planner/joinLink");

describe("mayRejoinTrip", () => {
  const removedAt = "2026-09-20T12:00:00.000Z";

  it("lets anyone with no row, an active row, or a self-leave in", () => {
    expect(mayRejoinTrip(null, null)).toBe(true);
    expect(mayRejoinTrip({ status: "active", left_at: null }, null)).toBe(true);
    expect(mayRejoinTrip({ status: "left", left_at: removedAt }, null)).toBe(true);
  });

  it("keeps a removed member out without a targeted invite", () => {
    expect(mayRejoinTrip({ status: "removed", left_at: removedAt }, null)).toBe(false);
    expect(mayRejoinTrip({ status: "removed", left_at: removedAt }, undefined)).toBe(false);
  });

  it("keeps a removed member out when their invite predates the removal", () => {
    expect(mayRejoinTrip({ status: "removed", left_at: removedAt }, "2026-09-01T00:00:00.000Z")).toBe(false);
    expect(mayRejoinTrip({ status: "removed", left_at: removedAt }, removedAt)).toBe(false);
  });

  it("lets a removed member back in through an invite made after the removal", () => {
    expect(mayRejoinTrip({ status: "removed", left_at: removedAt }, "2026-09-21T09:00:00.000Z")).toBe(true);
  });
});

describe("isInvitableEmail", () => {
  it.each(["sara@example.com", "a.b+trip@mail.co.uk"])("accepts %s", (email) => {
    expect(isInvitableEmail(email)).toBe(true);
  });

  it.each(["", "sara", "sara@", "@example.com", "sara@example", "sa ra@example.com", `${"a".repeat(250)}@x.com`])(
    "rejects %j",
    (email) => {
      expect(isInvitableEmail(email)).toBe(false);
    }
  );
});

describe("emailInviteUsedBySomeoneElse", () => {
  it("makes an email invite single-use, but not for its own acceptor", () => {
    expect(emailInviteUsedBySomeoneElse({ channel: "email", acceptedBy: null }, "u1")).toBe(false);
    expect(emailInviteUsedBySomeoneElse({ channel: "email", acceptedBy: "u1" }, "u1")).toBe(false);
    expect(emailInviteUsedBySomeoneElse({ channel: "email", acceptedBy: "u1" }, "u2")).toBe(true);
  });

  it("never limits the trip-wide share link", () => {
    expect(emailInviteUsedBySomeoneElse({ channel: "link", acceptedBy: "u1" }, "u2")).toBe(false);
  });
});

describe("joinTripById — removed vs. left", () => {
  // Just the query shapes joinTripById makes for a phone-less user: trip
  // lookup, existing-membership lookup, active count, then update/insert.
  function fakeAdmin(existing: { status: string; left_at: string | null } | null) {
    const writes: { kind: "update" | "insert"; value: unknown }[] = [];
    const admin = {
      from: (table: string) => ({
        select: (_cols: string, opts?: { count?: string }) => {
          const builder = {
            eq: () => builder,
            maybeSingle: async () => {
              if (table === "planner_trips") return { data: { id: "trip1", name: "Lisbon", twilio_conversation_sid: null } };
              if (table === "planner_memberships") return { data: existing ? { trip_id: "trip1", ...existing } : null };
              return { data: null };
            },
            then: (resolve: (v: { count: number | null }) => void) => resolve({ count: opts?.count ? 2 : null }),
          };
          return builder;
        },
        update: (value: unknown) => {
          writes.push({ kind: "update", value });
          const b = { eq: () => b, then: (r: (v: { error: null }) => void) => r({ error: null }) };
          return b;
        },
        insert: async (value: unknown) => {
          writes.push({ kind: "insert", value });
          return { error: null };
        },
      }),
    };
    return { admin: admin as never, writes };
  }

  const user = { id: "u1", phone: null };
  const removed = { status: "removed", left_at: "2026-09-20T12:00:00.000Z" };

  it("refuses a removed member coming back by code or share link", async () => {
    const { admin, writes } = fakeAdmin(removed);
    expect(await joinTripById(admin, user, "trip1")).toEqual({ outcome: "removed", tripName: "Lisbon" });
    expect(writes).toEqual([]);
  });

  it("refuses a removed member whose invite is older than the removal", async () => {
    const { admin, writes } = fakeAdmin(removed);
    const result = await joinTripById(admin, user, "trip1", { targetedInviteCreatedAt: "2026-09-01T00:00:00.000Z" });
    expect(result.outcome).toBe("removed");
    expect(writes).toEqual([]);
  });

  it("reactivates a removed member through a fresh targeted invite", async () => {
    const { admin, writes } = fakeAdmin(removed);
    const result = await joinTripById(admin, user, "trip1", { targetedInviteCreatedAt: "2026-09-22T00:00:00.000Z" });
    expect(result).toEqual({ outcome: "joined", tripName: "Lisbon" });
    expect(writes[0]).toMatchObject({ kind: "update", value: { status: "active" } });
  });

  it("lets someone who left on their own rejoin freely", async () => {
    const { admin, writes } = fakeAdmin({ status: "left", left_at: "2026-09-20T12:00:00.000Z" });
    expect((await joinTripById(admin, user, "trip1")).outcome).toBe("joined");
    expect(writes[0]).toMatchObject({ kind: "update", value: { status: "active" } });
  });

  it("names the trip in the removed message", () => {
    expect(removedFromTripMessage("Lisbon")).toContain('"Lisbon"');
  });
});

describe("transferOwner — never leaves a trip ownerless", () => {
  function fakeAdmin(failRole: "owner" | "member" | null) {
    const memberships: Record<string, { role: string; status: string }> = {
      a: { role: "owner", status: "active" },
      b: { role: "member", status: "active" },
    };
    const admin = {
      from: (table: string) => {
        if (table === "planner_memberships") {
          return {
            select: () => {
              let userId: string | undefined;
              const builder = {
                eq: (col: string, val: string) => {
                  if (col === "user_id") userId = val;
                  return builder;
                },
                maybeSingle: async () => ({ data: userId && memberships[userId] ? { trip_id: "t" } : null }),
              };
              return builder;
            },
            update: (value: { role: string }) => ({
              eq: () => ({
                eq: async (_c: string, userId: string) => {
                  if (value.role === failRole) return { error: { message: "boom" } };
                  memberships[userId] = { ...memberships[userId], ...value };
                  return { error: null };
                },
              }),
            }),
          };
        }
        return { update: () => ({ eq: async () => ({ error: null }) }) };
      },
    };
    return { admin: admin as never, memberships };
  }

  it("keeps the old owner when promoting the new one fails", async () => {
    const { admin, memberships } = fakeAdmin("owner");
    expect((await transferOwner(admin, "t", "a", "b")).outcome).toBe("error");
    expect(memberships.a.role).toBe("owner");
  });

  it("swaps the roles on success", async () => {
    const { admin, memberships } = fakeAdmin(null);
    expect(await transferOwner(admin, "t", "a", "b")).toEqual({ outcome: "ok" });
    expect(memberships).toMatchObject({ a: { role: "member" }, b: { role: "owner" } });
  });
});
