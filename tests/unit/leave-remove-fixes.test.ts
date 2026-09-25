import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/twilio/conversations", () => ({
  removeParticipantFromConversation: vi.fn().mockResolvedValue(undefined),
}));

import { isLeaveCommand, departMember, transferOwner } from "@/lib/planner/membership";

describe("isLeaveCommand", () => {
  it("matches the bare word, any case, with surrounding whitespace", () => {
    expect(isLeaveCommand("leave")).toBe(true);
    expect(isLeaveCommand("LEAVE")).toBe(true);
    expect(isLeaveCommand("  Leave  ")).toBe(true);
  });

  it("doesn't match leave used as an ordinary word in a sentence", () => {
    expect(isLeaveCommand("can't wait to leave")).toBe(false);
    expect(isLeaveCommand("when do we leave?")).toBe(false);
    expect(isLeaveCommand("leaving soon")).toBe(false);
    expect(isLeaveCommand("")).toBe(false);
  });
});

// A minimal fake admin covering exactly the query shapes departMember and
// transferOwner make, with per-table in-memory state so behavior (votes
// actually deleted, status actually updated) can be asserted afterward,
// not just "some query happened."
function fakeAdmin(seed: {
  memberships?: Record<string, { role: string; status: string }>;
  decisions?: { id: string; status: string }[];
  votes?: { decision_id: string; user_id: string }[];
  users?: Record<string, { phone: string | null; name: string | null; email: string | null }>;
  trip?: { twilio_conversation_sid: string | null };
}) {
  const memberships = { ...(seed.memberships ?? {}) };
  const decisions = seed.decisions ?? [];
  let votes = [...(seed.votes ?? [])];
  const users = seed.users ?? {};
  const trip = seed.trip ?? { twilio_conversation_sid: null };
  const activity: { trip_id: string; text: string }[] = [];

  const admin = {
    from: (table: string) => {
      if (table === "planner_memberships") {
        return {
          // Chains an arbitrary number of .eq() calls (isActiveMember adds
          // a third one departMember/transferOwner's direct lookups don't)
          // before resolving against the last "user_id"/"userId" filter seen.
          select: () => {
            let userId: string | undefined;
            let excluded: string | undefined;
            const builder = {
              eq: (col: string, val: string) => {
                if (col === "user_id") userId = val;
                return builder;
              },
              neq: (col: string, val: string) => {
                if (col === "user_id") excluded = val;
                return builder;
              },
              maybeSingle: async () => ({ data: userId && memberships[userId] ? { ...memberships[userId] } : null }),
              // The owner's "anyone else still on the trip?" head count.
              then: (resolve: (v: { count: number }) => unknown) =>
                resolve({
                  count: Object.entries(memberships).filter(([id, m]) => id !== excluded && m.status === "active").length,
                }),
            };
            return builder;
          },
          update: (value: Record<string, unknown>) => ({
            eq: () => ({
              eq: async (_c: string, userId: string) => {
                memberships[userId] = { ...memberships[userId], ...value } as { role: string; status: string };
                return { error: null };
              },
            }),
          }),
        };
      }
      if (table === "planner_decisions") {
        return {
          select: () => ({
            eq: () => ({
              eq: async (_c: string, status: string) => ({ data: decisions.filter((d) => d.status === status) }),
            }),
          }),
        };
      }
      if (table === "planner_decision_votes") {
        return {
          delete: () => ({
            eq: (_c: string, userId: string) => ({
              in: async (_c2: string, decisionIds: string[]) => {
                votes = votes.filter((v) => !(v.user_id === userId && decisionIds.includes(v.decision_id)));
                return { error: null };
              },
            }),
          }),
        };
      }
      if (table === "planner_trips") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: trip }) }) }),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === "planner_users") {
        return {
          select: () => ({
            eq: (_c: string, userId: string) => ({ maybeSingle: async () => ({ data: users[userId] ?? null }) }),
          }),
        };
      }
      if (table === "planner_trip_activity") {
        return { insert: async (value: { trip_id: string; text: string }) => { activity.push(value); return { error: null }; } };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  return { admin: admin as never, memberships, votes: () => votes, activity };
}

describe("departMember", () => {
  it("refuses to depart an owner while anyone else is on the trip", async () => {
    const { admin } = fakeAdmin({
      memberships: { u1: { role: "owner", status: "active" }, u2: { role: "member", status: "active" } },
    });
    const result = await departMember(admin, "trip1", "u1", { kind: "left" });
    expect(result).toEqual({ outcome: "must_transfer_first" });
  });

  it("refuses someone already gone", async () => {
    const { admin } = fakeAdmin({ memberships: { u1: { role: "member", status: "left" } } });
    const result = await departMember(admin, "trip1", "u1", { kind: "left" });
    expect(result).toEqual({ outcome: "already_gone" });
  });

  it("returns not_found for a non-member", async () => {
    const { admin } = fakeAdmin({ memberships: {} });
    const result = await departMember(admin, "trip1", "ghost", { kind: "left" });
    expect(result).toEqual({ outcome: "not_found" });
  });

  it("marks status left, withdraws open-decision votes, keeps closed-decision votes", async () => {
    const { admin, memberships, votes } = fakeAdmin({
      memberships: { u1: { role: "member", status: "active" } },
      decisions: [
        { id: "open1", status: "open" },
        { id: "closed1", status: "closed" },
      ],
      votes: [
        { decision_id: "open1", user_id: "u1" },
        { decision_id: "closed1", user_id: "u1" },
      ],
      users: { u1: { phone: null, name: "Sam", email: null } },
    });
    const result = await departMember(admin, "trip1", "u1", { kind: "left" });
    expect(result).toEqual({ outcome: "left" });
    expect(memberships.u1.status).toBe("left");
    expect(votes()).toEqual([{ decision_id: "closed1", user_id: "u1" }]);
  });

  it("marks status removed with removed_by set", async () => {
    const { admin, memberships } = fakeAdmin({
      memberships: { u1: { role: "member", status: "active" } },
      users: { u1: { phone: null, name: "Sam", email: null } },
    });
    const result = await departMember(admin, "trip1", "u1", { kind: "removed", removedBy: "owner1" });
    expect(result).toEqual({ outcome: "removed" });
    expect(memberships.u1.status).toBe("removed");
  });

  it("logs a low-key activity note naming the person and the outcome", async () => {
    const { admin, activity } = fakeAdmin({
      memberships: { u1: { role: "member", status: "active" } },
      users: { u1: { phone: null, name: "Sam Okafor", email: null } },
    });
    await departMember(admin, "trip1", "u1", { kind: "left" });
    expect(activity).toEqual([{ trip_id: "trip1", text: "Sam left the trip." }]);
  });
});

describe("transferOwner", () => {
  it("refuses to transfer to someone not an active member", async () => {
    const { admin } = fakeAdmin({ memberships: { owner1: { role: "owner", status: "active" } } });
    const result = await transferOwner(admin, "trip1", "owner1", "ghost");
    expect(result).toEqual({ outcome: "not_member" });
  });

  it("demotes the old owner and promotes the new one", async () => {
    const { admin, memberships } = fakeAdmin({
      memberships: {
        owner1: { role: "owner", status: "active" },
        member1: { role: "member", status: "active" },
      },
    });
    const result = await transferOwner(admin, "trip1", "owner1", "member1");
    expect(result).toEqual({ outcome: "ok" });
    expect(memberships.owner1.role).toBe("member");
    expect(memberships.member1.role).toBe("owner");
  });
});

describe("ownerDepartAction — a solo organizer leaving deletes the trip", () => {
  it("deletes when the owner leaves and nobody else is on the trip", async () => {
    const { ownerDepartAction } = await import("@/lib/planner/membership");
    expect(ownerDepartAction("left", 0)).toBe("delete_trip");
  });

  it("still requires a hand-off when anyone else is on the trip", async () => {
    const { ownerDepartAction } = await import("@/lib/planner/membership");
    expect(ownerDepartAction("left", 1)).toBe("must_transfer_first");
    expect(ownerDepartAction("left", 9)).toBe("must_transfer_first");
  });

  it("never deletes on a removal", async () => {
    const { ownerDepartAction } = await import("@/lib/planner/membership");
    expect(ownerDepartAction("removed", 0)).toBe("must_transfer_first");
  });
});
