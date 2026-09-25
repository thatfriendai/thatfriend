import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Static guards for two bugs the leave/remove migration (2026-09-28)
// introduced across the codebase at once, both silent at runtime:
//
// 1. planner_memberships.removed_by is a SECOND foreign key to
//    planner_users, so a bare `planner_users(...)` embed selected from
//    planner_memberships is ambiguous — PostgREST fails the whole query
//    with PGRST201 and `data` comes back null, which every caller read as
//    "empty roster".
// 2. A membership row now outlives the membership (status 'left' /
//    'removed'), so "is there a row?" is no longer "is this person on the
//    trip?" — every gate has to ask for status 'active'.
//
// Both are easy to reintroduce in a new route or loader, and neither
// shows up in a type check, hence a grep-level test.

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");
const TRIP_API = join(SRC, "app", "api", "v2", "trips", "[id]");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * Each `.from("planner_memberships")` query chain in a file — from the
 * `.from(` up to where the statement (or Promise.all array entry) ends.
 * Deliberately rough: a chain ends at the first `;`, the next `.from(`, or
 * a terminal `.maybeSingle()` / `.single()`, which is enough for how this
 * codebase writes Supabase queries.
 */
function membershipChains(source: string): string[] {
  const chains: string[] = [];
  const re = /\.from\("planner_memberships"\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const rest = source.slice(m.index + m[0].length);
    const ends = [rest.indexOf(";"), rest.indexOf(".from("), rest.search(/\.(maybeSingle|single)\(\)/)]
      .filter((i) => i >= 0);
    const end = ends.length ? Math.min(...ends) : rest.length;
    chains.push(m[0] + rest.slice(0, end));
  }
  return chains;
}

const rel = (f: string) => relative(ROOT, f);

describe("planner_memberships → planner_users embeds", () => {
  it("always name the user_id FK (removed_by made a bare embed ambiguous)", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      for (const chain of membershipChains(readFileSync(file, "utf8"))) {
        const select = chain.match(/\.select\(\s*"([^"]*)"/)?.[1] ?? "";
        // Any planner_users embed not immediately hinted with the user_id FK.
        if (/planner_users(?!!planner_memberships_user_id_fkey)\s*\(/.test(select)) {
          offenders.push(`${rel(file)}: ${select}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("trip API membership gates", () => {
  const routes = walk(TRIP_API).filter((f) => f.endsWith("route.ts"));

  // Routes that read planner_memberships without needing an active-status
  // filter. Keep this list short and explain each entry.
  const EXCEPTIONS = new Set<string>([
    // (none yet)
  ]);

  it("finds the trip routes (guards against the walk silently matching nothing)", () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it("every route that queries planner_memberships also filters on status (or uses the shared helpers)", () => {
    const offenders = routes.filter((file) => {
      const source = readFileSync(file, "utf8");
      if (!source.includes('from("planner_memberships")')) return false;
      if (EXCEPTIONS.has(rel(file))) return false;
      return !/"status"|isActiveMember|activeMembersOf/.test(source);
    });
    expect(offenders.map(rel)).toEqual([]);
  });

  it("every per-user membership read requires status 'active'", () => {
    // Stricter than the file-level check above: a route can filter status
    // in one query and still gate on a bare row in another (e.g. a GET
    // and a PATCH handler in the same file).
    const offenders: string[] = [];
    for (const file of routes) {
      if (EXCEPTIONS.has(rel(file))) continue;
      for (const chain of membershipChains(readFileSync(file, "utf8"))) {
        const isRead = /\.select\(/.test(chain) && !/\.(insert|update|upsert|delete)\(/.test(chain);
        const isPerUser = /\.(eq|in)\("user_id"/.test(chain);
        if (isRead && isPerUser && !/\.eq\("status",\s*"active"\)/.test(chain)) {
          offenders.push(`${rel(file)}: ${chain.replace(/\s+/g, " ").slice(0, 160)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
