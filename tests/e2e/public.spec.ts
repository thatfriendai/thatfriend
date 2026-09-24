import { expect, test } from "@playwright/test";
import { expectAccessible, expectHealthyPage, watchForErrors } from "./helpers";

/**
 * What a friend sees before they have an account: the landing page, sign-in,
 * and every flavor of invite link — including broken, expired and mangled
 * ones, since links get truncated by SMS apps and copy-pasted badly.
 */

const PUBLIC_PAGES = ["/", "/planner/login", "/privacy", "/terms"];

for (const path of PUBLIC_PAGES) {
  test(`${path} renders cleanly`, async ({ page }) => {
    const errors = watchForErrors(page);
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
    await expectHealthyPage(page, errors);
  });

  test(`${path} has no blocking accessibility issues`, async ({ page }) => {
    await page.goto(path);
    await expectAccessible(page);
  });
}

const BAD_INVITES = [
  "/j/not-a-real-token",
  "/j/lisbon/not-a-real-token",
  "/planner/join/lisbon/not-a-real-token",
  // SMS apps sometimes swallow the last character or append punctuation.
  "/j/lisbon/abc123.",
  "/planner/join/istanbul",
];

for (const path of BAD_INVITES) {
  test(`bad invite ${path} explains itself instead of crashing`, async ({ page }) => {
    const errors = watchForErrors(page);
    const res = await page.goto(path);
    expect(res?.status(), "a dead link should be a friendly page, not a 500").toBeLessThan(500);
    await expectHealthyPage(page, errors);
  });
}

test("signed-out visitors are sent to sign in, not shown an error", async ({ page }) => {
  for (const path of ["/planner/home", "/planner/trips", "/planner/profile"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/planner\/login/);
  }
});

test("the login form rejects a malformed phone/email without a server error", async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto("/planner/login");
  const input = page.locator("input").first();
  await input.fill("not an email or phone");
  await input.press("Enter");
  await page.waitForTimeout(1000);
  await expectHealthyPage(page, errors);
});

test("every in-page link on the homepage points at a section that exists", async ({ page }) => {
  await page.goto("/");
  const hashes = await page.$$eval('a[href^="#"]', (as) => [...new Set(as.map((a) => a.getAttribute("href")!.slice(1)))]);
  for (const id of hashes.filter(Boolean)) {
    expect(await page.locator(`[id="${id}"]`).count(), `#${id} has no target`).toBeGreaterThan(0);
  }
});

test("Start planning brings a signed-out visitor back to the new-trip form after sign-in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start planning" }).first().click();
  await expect(page).toHaveURL(/\/planner\/login\?next=%2Fplanner%2Ftrips%2Fnew/);
});
