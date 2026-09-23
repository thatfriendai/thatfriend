import { expect, test, type BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { existsSync, readFileSync } from "node:fs";
import { PEOPLE, TRIPS, type PersonaKey, type TripKey } from "../../qa/fixtures";
import { expectHealthyPage, watchForErrors } from "./helpers";

/**
 * Every persona opens every trip they're on, on every screen of it — the
 * scenario matrix from docs/qa/SCENARIOS.md, automated for the "does it
 * render sensibly for this person" layer. Needs `npm run qa:seed` against a
 * staging project first; skipped otherwise.
 */

interface Seed {
  password: string;
  users: Record<string, { id: string; email: string }>;
  trips: Record<string, { id: string; members: PersonaKey[] }>;
}

const seedFile = "qa/.seed.json";
const seed: Seed | null = existsSync(seedFile) ? JSON.parse(readFileSync(seedFile, "utf8")) : null;
const seeded = !!seed?.users && Object.keys(seed.users).length > 0;

test.skip(!seeded, "Run `npm run qa:seed` against a staging Supabase project to enable persona specs.");

/** Signs in with supabase-js exactly as the app would and hands the browser the same cookies. */
async function signInAs(context: BrowserContext, persona: PersonaKey, baseURL: string) {
  const cookies: { name: string; value: string }[] = [];
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [],
      setAll: (set) => {
        cookies.push(...set.map(({ name, value }) => ({ name, value })));
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email: seed!.users[persona].email, password: seed!.password });
  if (error) throw new Error(`sign-in as ${persona} failed: ${error.message} (is email+password auth enabled on staging?)`);
  // setAll fires from the auth state listener — give it a tick.
  await new Promise((r) => setTimeout(r, 50));
  await context.addCookies(cookies.map((c) => ({ ...c, url: baseURL })));
}

const TRIP_SCREENS = ["", "/dates", "/reviews"];

for (const [tripKey, trip] of Object.entries(TRIPS) as [TripKey, (typeof TRIPS)[TripKey]][]) {
  for (const persona of trip.members as PersonaKey[]) {
    test(`${PEOPLE[persona].name} (${persona}) on "${trip.name}"`, async ({ page, context, baseURL }) => {
      await signInAs(context, persona, baseURL!);
      const tripId = seed!.trips[tripKey].id;

      for (const screen of TRIP_SCREENS) {
        const errors = watchForErrors(page);
        const res = await page.goto(`/planner/trips/${tripId}${screen}`);
        expect(res?.status(), `${screen || "trip"} page status`).toBeLessThan(400);
        await expect(page).not.toHaveURL(/\/planner\/login/);
        await expectHealthyPage(page, errors);
        await page.screenshot({ path: `qa/reports/screens/${tripKey}/${persona}${screen.replace("/", "-") || "-trip"}.png`, fullPage: true });
      }
    });
  }
}

test("home lists every trip the organizer is on", async ({ page, context, baseURL }) => {
  await signInAs(context, "organizer", baseURL!);
  const errors = watchForErrors(page);
  await page.goto("/planner/trips");
  for (const [key, trip] of Object.entries(TRIPS)) {
    if ((trip.members as string[]).includes("organizer")) {
      await expect(page.getByText(trip.name, { exact: false }).first(), `${key} missing from trips list`).toBeVisible();
    }
  }
  await expectHealthyPage(page, errors);
});

test("a non-member can't open someone else's trip", async ({ page, context, baseURL }) => {
  await signInAs(context, "lateJoiner", baseURL!);
  const res = await page.goto(`/planner/trips/${seed!.trips.solo.id}`);
  expect(res?.status()).toBe(404);
});
