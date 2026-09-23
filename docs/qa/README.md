# QA process

How That Friend gets tested before friends see a change, and how their bug
reports turn into fixes that stay fixed. The QA agent
(`.claude/skills/qa/SKILL.md`, run it with `/qa` in Claude Code) follows this
same process. The rest of this doc covers what it does and why.

## The layers

Most of the checks are cheap and run on every change. The expensive ones run
less often. Each layer catches a different kind of bug:

| Layer | What it catches | Command | When |
| --- | --- | --- | --- |
| Lint + types | Typos, hooks misuse, wrong shapes | `npm run lint`, `npm run typecheck` | Every PR (CI) |
| Unit tests | Date math, phone parsing, dedupe, tie-breaks, SMS keyword handling, SSRF guard | `npm test` | Every PR (CI) |
| Classifier eval | The SMS router's prompt sending texts to the wrong place | `npm run eval:intent` | PRs touching `inboundIntent.ts` / `smsVoice.ts` (CI) |
| Browser e2e: public | Crashes, `undefined`/`NaN` on screen, sideways scroll on phones, accessibility blockers, dead invite links | `npm run test:e2e` | Every preview deploy (CI) |
| Browser e2e: personas | Every persona × every trip × every trip screen renders sensibly, and access control | `npm run qa:seed`, then `npm run test:e2e` | Before a friends round; on preview deploys once staging is seeded |
| Scenario walkthrough | Flows that need judgement: joining by text, voting, locking dates, the group thread | QA agent + [SCENARIOS.md](SCENARIOS.md) | Before each friends round, and after risky merges |
| Code audit | Security holes and race conditions tests don't reach | QA agent (`/qa audit <area>`) | Before each friends round; when an area changes a lot |

`npm run qa` runs the first three rows locally. Run it before you push.

## The cast and the trips

[`qa/fixtures.ts`](../../qa/fixtures.ts) defines ten personas and eleven trip
shapes. Each one is there because it breaks an assumption the happy path
makes:

- **People**
  - **Maya** is the organizer and the happy path.
  - **Jordan** opens the invite in iMessage's in-app browser.
  - **Sam** only ever texts.
  - **Deniz** has a Turkish number and lives in UTC+3.
  - **Olivia** types a UK number with no country code.
  - **Alex** and **Alex** share a first name.
  - **Zoë-Marie** has accents, an apostrophe and an emoji in her name.
  - **Priya** joins late.
  - **Chris** uses VoiceOver at 200% text size.
- **Trips**
  - A 3-day US weekend.
  - An 8-day Lisbon trip with members in four timezones.
  - A trip with no dates and no destination.
  - A day trip.
  - New Year's across the year boundary.
  - A weekend across the DST change.
  - A three-week trip.
  - A 10-person bachelorette.
  - A solo trip.
  - An accented destination.
  - A trip that has already ended.

Unit tests, e2e specs, the seed script and bug reports all use the same
names. "Deniz on the Lisbon trip, Dates screen" is a complete repro setup.

When a friend hits a bug that none of these would have caught, add the
persona or trip that would have. The cast should grow with every beta round.

## Environments

- **Local**: `npm run dev` with `.env.local`. For unit tests and quick checks.
- **Staging**: a separate Supabase project and a separate Twilio number, or
  Twilio test credentials. Seed it with `QA_SEED_PROJECT=<ref> npm run qa:seed`.
  The seed script refuses to run unless that ref matches the URL in
  `.env.local`, so it can't write into production by mistake. Reset it with
  `npm run qa:reset`.
- **Vercel previews**: every PR gets one. `.github/workflows/e2e-preview.yml`
  runs the browser suite against it. To make that work, set these repo
  secrets:
  - `VERCEL_AUTOMATION_BYPASS_SECRET`, if Deployment Protection is on.
  - `STAGING_SUPABASE_URL` and `STAGING_SUPABASE_ANON_KEY`.
  - `QA_SEED_JSON`: the contents of `qa/.seed.json`, for the persona specs.
- **Production**: never run e2e or seed against it. After a deploy, the only
  checks are the post-ship smoke steps in
  [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

For SMS, `scripts/simulate-inbound.mjs` sends a signed inbound text to your
**local** server. It only goes to production if you pass `--prod`. Use Twilio's
magic numbers (`+15005550006`) so no real person gets a text.

## Severity and triage

| | Meaning | Response |
| --- | --- | --- |
| **P0** | Security hole, data loss, a crash on a main path, texts sent to the wrong people | Fix before anyone else touches the build. Tell affected testers. |
| **P1** | Wrong behavior a tester will notice: wrong day, wrong count, a stuck button, a silent failure | Fix before the next friends round |
| **P2** | Cosmetic, or an edge case with a workaround | Batch it and fix when nearby code changes |

Every beta report gets a severity, a persona × trip × screen repro, and one of
two outcomes:

- It becomes a regression test, then a fix.
- It goes into [KNOWN_ISSUES.md](KNOWN_ISSUES.md) with the reason it isn't
  being fixed.

## The regression rule

**Every fixed bug gets a test that fails without the fix.** Put the test at
the cheapest layer that can catch it:

- Pure logic goes in a unit test (`tests/unit/`).
- A routing or wording problem in SMS goes in `INBOUND_TEXTS` in
  `qa/fixtures.ts`.
- A rendering problem goes in an e2e spec.

This is how a bug found by one friend stays fixed for all of them.

## Friends beta rounds

1. Run the [release checklist](RELEASE_CHECKLIST.md), including a full
   `/qa sweep`.
2. Send testers [BETA_GUIDE.md](BETA_GUIDE.md), which covers what to try and
   how to report.
3. Triage reports daily with `/qa triage`. Each report becomes an issue with
   the `beta` label.
4. At the end of the round, add every new persona or trip shape the round
   surfaced to `qa/fixtures.ts`.
