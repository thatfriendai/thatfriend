/**
 * Golden-set eval for the inbound-text router (src/lib/planner/inboundIntent.ts).
 * Unit tests can't cover it — the interesting part is the prompt, so this
 * calls the real model. Run it whenever the classifier prompt, the model id,
 * or smsVoice routing changes:
 *
 *   ANTHROPIC_API_KEY=... npm run eval:intent
 *
 * Cases live in qa/fixtures.ts (INBOUND_TEXTS). When a friend's text gets
 * routed wrong in beta, add it there with the expected route — that's the
 * regression test.
 */
import { classifyIntent } from "@/lib/planner/inboundIntent";
import { INBOUND_TEXTS } from "../fixtures";

const PASS_RATE = 0.9;

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("eval:intent skipped — set ANTHROPIC_API_KEY to run it against the real classifier.");
  process.exit(0);
}

function label(intent: Awaited<ReturnType<typeof classifyIntent>>): string {
  return intent.kind === "question" ? `question:${intent.topic}` : intent.kind;
}

const results = await Promise.all(
  INBOUND_TEXTS.map(async (c) => {
    const got = label(await classifyIntent(c.text, { hasTrips: c.hasTrips }));
    const ok = c.expect.includes(":") ? got === c.expect : got.split(":")[0] === c.expect;
    return { ...c, got, ok };
  })
);

for (const r of results) {
  const mark = r.ok ? "✓" : "✗";
  console.log(`${mark} ${JSON.stringify(r.text).slice(0, 60).padEnd(62)} expected ${r.expect.padEnd(22)} got ${r.got}`);
}
const passed = results.filter((r) => r.ok).length;
const rate = passed / results.length;
console.log(`\n${passed}/${results.length} routed correctly (${Math.round(rate * 100)}%, need ${PASS_RATE * 100}%)`);
if (rate < PASS_RATE && results.every((r) => r.ok || r.got === "add_place")) {
  console.log("Every miss came back add_place — that is also what the classifier returns on an API error, so check the key/model id first.");
}
process.exit(rate >= PASS_RATE ? 0 : 1);
