import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Text that should never reach a user's screen — each one is a bug that
 * slipped past types (a missing field, a bad date parse, a template with a
 * hole in it). Matched as whole words in visible text only.
 */
const LEAKED_VALUES = /\b(?:undefined|NaN|Invalid Date|\[object Object\])\b|(?:^|\s)null(?:\s|$)/;

/** Collects console errors and failed same-origin requests for the page's lifetime. */
export function watchForErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // Third-party noise we don't control (Maps key restrictions on preview URLs, etc.).
    if (/maps\.googleapis|Google Maps JavaScript API|favicon|GSI_LOGGER|accounts\.google\.com/i.test(text)) return;
    errors.push(`console: ${text}`);
  });
  page.on("response", (r) => {
    const url = new URL(r.url());
    if (r.status() >= 500 && url.origin === new URL(page.url() || r.url()).origin) {
      errors.push(`${r.status()} ${url.pathname}`);
    }
  });
  return errors;
}

/** The checks every screen gets, whoever is looking at it. */
export async function expectHealthyPage(page: Page, errors: string[]) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const text = await page.locator("body").innerText();
  expect(text, "a raw undefined/NaN/null/Invalid Date is showing").not.toMatch(LEAKED_VALUES);
  expect(text, "Next.js error overlay or crash page").not.toMatch(/Application error|Unhandled Runtime Error|This page couldn’t load/i);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page scrolls sideways — something is wider than the phone").toBeLessThanOrEqual(1);

  expect(errors, "console errors / 5xx responses").toEqual([]);
}

/**
 * Serious and critical axe violations only — the ones that block someone
 * from using the page. Colour contrast is reported but not failed on: the
 * muted greys in the palette (#8C8478, #A19A8E) are below 4.5:1 on the
 * cream backgrounds everywhere, which is a design-system decision to make
 * once, not something to trip every run on. See docs/qa/KNOWN_ISSUES.md.
 */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const contrast = serious.find((v) => v.id === "color-contrast");
  if (contrast) {
    test.info().annotations.push({ type: "a11y-warning", description: `color-contrast on ${contrast.nodes.length} elements` });
  }
  expect(
    serious.filter((v) => v.id !== "color-contrast").map((v) => `${v.id} (${v.nodes.length}): ${v.help}`),
    "serious/critical accessibility violations"
  ).toEqual([]);
}
