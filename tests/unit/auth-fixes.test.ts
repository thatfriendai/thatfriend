import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// session.ts and joinLink.ts pull in request-bound Supabase/Twilio helpers
// at import time; none of the functions under test touch them.
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/planner/smsTripStart", () => ({ joinTripById: vi.fn() }));
vi.mock("@/lib/planner/consent", () => ({ recordConsentEvent: vi.fn() }));

const { safeNextPath } = await import("@/lib/planner/session");
const { inviteIsForPhone } = await import("@/lib/planner/joinLink");
const { isSyntheticPhoneEmail } = await import("@/lib/planner/phoneSession");
const { mergePlannerUsers } = await import("@/lib/planner/plannerUser");

describe("safeNextPath", () => {
  it.each(["/planner/home", "/planner/trips/abc?tab=dates", "/planner/u/idil#trips", "/"])("allows %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "//evil.com",
    "//evil.com/planner",
    "/\\evil.com",
    "/planner\\..\\evil",
    "https://evil.com",
    "javascript:alert(1)",
    "@evil.com",
    "evil.com",
    "planner/home",
    "/\t/evil.com",
    "/\n/evil.com",
  ])("rejects %j", (path) => {
    expect(safeNextPath(path)).toBeNull();
  });
});

describe("inviteIsForPhone", () => {
  it("matches the invited number regardless of formatting", () => {
    expect(inviteIsForPhone("+14155550101", "+14155550101")).toBe(true);
    expect(inviteIsForPhone("+14155550101", "(415) 555-0101")).toBe(true);
  });

  it("rejects a different number or no number", () => {
    expect(inviteIsForPhone("+14155550101", "+14155550102")).toBe(false);
    expect(inviteIsForPhone("+14155550101", null)).toBe(false);
    // acceptInviteToken lets an account with no phone yet through before it
    // gets here (web sign-ups invited by text) — see joinLink.ts.
    expect(inviteIsForPhone("+14155550101", "")).toBe(false);
  });
});

describe("isSyntheticPhoneEmail", () => {
  it("recognizes the phone-only placeholder, and only that", () => {
    expect(isSyntheticPhoneEmail("phone-14155550101@phone.thatfriend.internal")).toBe(true);
    expect(isSyntheticPhoneEmail("idil@example.com")).toBe(false);
    expect(isSyntheticPhoneEmail("phone.thatfriend.internal@example.com")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// A tiny in-memory stand-in for the PostgREST query builder — only the
// calls mergePlannerUsers makes (select/update/delete/upsert with eq/is/or/
// contains filters). Enough to check what ends up where after a merge.
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;

function fakeAdmin(tables: Record<string, Row[]>) {
  function from(table: string) {
    const rows = (tables[table] ??= []);
    const filters: ((r: Row) => boolean)[] = [];
    let op: { kind: "select" } | { kind: "update"; patch: Row } | { kind: "delete" } | { kind: "upsert"; row: Row; conflict: string[] } = {
      kind: "select",
    };
    const run = () => {
      if (op.kind === "upsert") {
        const { row, conflict } = op;
        if (!rows.some((r) => conflict.every((c) => r[c] === row[c]))) rows.push({ ...row });
        return { data: null, error: null };
      }
      const hits = rows.filter((r) => filters.every((f) => f(r)));
      if (op.kind === "update") {
        const patch = op.patch;
        hits.forEach((r) => Object.assign(r, patch));
        return { data: hits, error: null };
      }
      if (op.kind === "delete") {
        tables[table] = rows.filter((r) => !hits.includes(r));
        return { data: null, error: null };
      }
      return { data: hits.map((r) => ({ ...r })), error: null };
    };
    const builder = {
      select: () => builder,
      update: (patch: Row) => ((op = { kind: "update", patch }), builder),
      delete: () => ((op = { kind: "delete" }), builder),
      upsert: (row: Row, opts: { onConflict: string }) => (
        (op = { kind: "upsert", row, conflict: opts.onConflict.split(",") }), builder
      ),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), builder),
      is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), builder),
      contains: (c: string, v: unknown[]) => (filters.push((r) => v.every((x) => (r[c] as unknown[]).includes(x))), builder),
      or: (expr: string) => {
        const clauses = expr.split(",").map((part) => {
          const [col, , val] = part.split(".");
          return (r: Row) => r[col] === val;
        });
        filters.push((r) => clauses.some((f) => f(r)));
        return builder;
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    };
    return builder;
  }
  return {
    tables,
    client: { from, auth: { admin: { deleteUser: vi.fn(async () => ({})) } } } as unknown as SupabaseClient,
  };
}

// Ids chosen so STALE sorts between the others — exercises re-ordering of friendship pairs.
const KEEP = "b-keep";
const STALE = "c-stale";
const FRIEND_A = "a-friend";
const FRIEND_Z = "z-friend";

describe("mergePlannerUsers", () => {
  it("keeps 'owner' when a duplicate membership is dropped", async () => {
    const { client, tables } = fakeAdmin({
      planner_users: [{ id: KEEP }, { id: STALE }],
      planner_memberships: [
        { trip_id: "t1", user_id: STALE, role: "owner" },
        { trip_id: "t1", user_id: KEEP, role: "member" },
        { trip_id: "t2", user_id: STALE, role: "member" },
      ],
    });
    await mergePlannerUsers(client, STALE, KEEP, null);
    expect(tables.planner_memberships).toEqual([
      { trip_id: "t1", user_id: KEEP, role: "owner" },
      { trip_id: "t2", user_id: KEEP, role: "member" },
    ]);
    expect(tables.planner_users).toEqual([{ id: KEEP }]);
  });

  it("moves the tables the merge used to drop", async () => {
    const { client, tables } = fakeAdmin({
      planner_place_ratings: [{ trip_id: "t1", place_id: "p1", user_id: STALE, rating: 5 }],
      planner_travel_legs: [
        { trip_id: "t1", direction: "arrive", user_id: STALE },
        { trip_id: "t1", direction: "arrive", user_id: KEEP },
      ],
      planner_trip_lessons: [{ trip_id: "t1", user_id: STALE, body: "Book earlier" }],
      planner_saved_places: [
        { id: "s1", user_id: STALE, source_place_id: null },
        { id: "s2", user_id: KEEP, source_place_id: null },
        { id: "s3", user_id: STALE, source_place_id: "p9" },
      ],
      planner_ride_groups: [{ id: "r1", member_ids: [STALE, KEEP, FRIEND_A], created_by: STALE }],
    });
    await mergePlannerUsers(client, STALE, KEEP, null);
    expect(tables.planner_place_ratings[0].user_id).toBe(KEEP);
    expect(tables.planner_travel_legs).toEqual([{ trip_id: "t1", direction: "arrive", user_id: KEEP }]);
    expect(tables.planner_trip_lessons[0].user_id).toBe(KEEP);
    // Null source_place_id never collides — both saved places survive.
    expect(tables.planner_saved_places.map((r) => [r.id, r.user_id])).toEqual([
      ["s1", KEEP],
      ["s2", KEEP],
      ["s3", KEEP],
    ]);
    expect(tables.planner_ride_groups[0]).toMatchObject({ member_ids: [KEEP, FRIEND_A], created_by: KEEP });
  });

  it("re-orders friendships and never creates a self-follow or self-friendship", async () => {
    const { client, tables } = fakeAdmin({
      planner_follows: [
        { follower_id: STALE, followee_id: KEEP },
        { follower_id: STALE, followee_id: FRIEND_A },
        { follower_id: FRIEND_Z, followee_id: STALE },
      ],
      planner_friendships: [
        { user_a: FRIEND_A, user_b: STALE, source: "trip", created_at: "x" },
        { user_a: STALE, user_b: FRIEND_Z, source: "manual", created_at: "y" },
        { user_a: KEEP, user_b: STALE, source: "trip", created_at: "z" },
      ],
    });
    await mergePlannerUsers(client, STALE, KEEP, null);
    expect(tables.planner_follows).toEqual([
      { follower_id: KEEP, followee_id: FRIEND_A },
      { follower_id: FRIEND_Z, followee_id: KEEP },
    ]);
    expect(tables.planner_friendships).toEqual([
      { user_a: FRIEND_A, user_b: KEEP, source: "trip", created_at: "x" },
      { user_a: KEEP, user_b: FRIEND_Z, source: "manual", created_at: "y" },
    ]);
  });
});
