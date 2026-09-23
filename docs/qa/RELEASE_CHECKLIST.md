# Release checklist

Copy this into the PR description, or into the issue for a friends round,
and tick the boxes as you go.

## Before merging a feature

- [ ] `npm run qa` passes locally: lint, typecheck and unit tests.
- [ ] Every bug fixed in this PR has a regression test (see the regression
      rule in [README.md](README.md)).
- [ ] New pure logic has unit tests covering at least the fixture trips:
      a date range, the empty case, and one weird input.
- [ ] Changed the SMS router or replies? Run `npm run eval:intent` and add
      the new phrasings to `INBOUND_TEXTS`.
- [ ] New API route? It checks sign-in, checks membership or ownership,
      validates every field (types, ranges, lengths), and returns 4xx rather
      than 500 on bad input.
- [ ] New client form? It has a double-submit guard, shows an error when
      `!res.ok` or the network fails, and never gets stuck disabled.
- [ ] New date code? It uses `src/lib/planner/calendarDate.ts`. That means no
      `new Date("YYYY-MM-DD…").toISOString()` and no
      `new Date().toISOString().slice(0, 10)` for "today".
- [ ] Schema change? There's an idempotent file in `supabase/migrations/`, and
      the code still works before that migration has been run.
- [ ] New env var? It's in `.env.local.example` and set in Vercel for
      Preview and Production.
- [ ] CI is green on the preview deploy, including e2e.
- [ ] The QA agent ran on the diff (`/qa pr`), and every P0 and P1 it found
      is fixed or written up in KNOWN_ISSUES.md.

## Before a friends beta round

Do everything above, and also:

- [ ] Staging is seeded fresh (`npm run qa:reset && npm run qa:seed`) and the
      persona e2e suite passes.
- [ ] Full sweep (`/qa sweep`): every journey J1–J11 in
      [SCENARIOS.md](SCENARIOS.md) walked on a real phone, iOS Safari first.
- [ ] SMS end to end on a real handset: a first text, an invite, the
      "reply 1" join, a forwarded link, STOP and then START.
- [ ] Crons are authenticated: `CRON_SECRET` is set in Vercel, and an
      unauthenticated `curl` to `/api/v2/cron/*` returns 401.
- [ ] `META_APP_SECRET` is set if WhatsApp is live. An unsigned POST returns
      403.
- [ ] Migrations in `supabase/migrations/` have been applied to production.
- [ ] [KNOWN_ISSUES.md](KNOWN_ISSUES.md) is up to date, and anything a tester
      will run into is mentioned in BETA_GUIDE.md.
- [ ] The testers' phone numbers are US numbers. SMS is US-only for now.

## Right after deploying to production (5 minutes)

- [ ] `/` and `/planner/login` load on a phone.
- [ ] Sign in, open an existing trip, and open its Dates screen.
- [ ] Text "hey" to the That Friend number from a known phone and get a reply.
- [ ] Vercel → Logs: no new 5xx in the first 10 minutes.
- [ ] Something wrong? Use Vercel → Deployments → the previous deploy →
      "Promote to Production". Roll back first, then debug.
