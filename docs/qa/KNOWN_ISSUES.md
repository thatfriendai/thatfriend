# Known issues

These were found in QA and deliberately not fixed yet, each with the reason.
Every item needs either a product decision or a console change, or it's
low-impact enough to batch for later. Check this list before a friends
round. Anything a tester is likely to hit should also be mentioned in
BETA_GUIDE.md.

Last full sweep: 2026-09-23. Last sweep: 2026-09-25 (fixed everything in the "Minor, batch for later" section and the muted-grey contrast issue below).

## Needs a console or config change (do these before the next round)

| What | Where |
| --- | --- |
| Set `CRON_SECRET`. Without it the cron routes return 401 and stop running. | Vercel env: Production and Preview |
| Set `META_APP_SECRET`. Without it production rejects every WhatsApp webhook with a 403. | Vercel env, taken from Meta App settings → Basic → App secret |
| Run `supabase/migrations/2026-09-23-qa-hardening.sql`, which adds the OTP `attempts` column. Until it runs, one wrong code guess deletes the code, which is safe but annoying. | Supabase SQL editor, on staging and production |
| The auth redirect allow-list must accept `/api/v2/auth/callback` with any query string. The callback URL now also carries `next`. | Supabase → Auth → URL Configuration |
| **Magic links fail when opened in a different browser** from the one that asked for them. PKCE keeps the verifier in the requesting browser's cookie, so a link opened from the Gmail or iOS Mail in-app browser shows "Could not sign in". The fix is to switch the email template to `token_hash` and call `verifyOtp` in the callback. | Supabase email template, plus `src/app/api/v2/auth/callback/route.ts` |

## Needs a product decision

- ~~**P1 · Email invitees never get anything.**~~ — **fixed 2026-09-27
  (P1-A).** Sends for real now, via Resend (`src/lib/planner/email.ts`) —
  needs `RESEND_API_KEY` set and `RESEND_FROM_EMAIL` on a verified domain
  before it actually delivers (see `.env.local.example`); without it, a
  send fails loudly instead of faking success. `planner_invites` tracks a
  real `status` (`pending`/`sent`/`delivered`/`failed`/`bounced`; the last
  two need a Resend webhook to fire, not built here — synchronous sends
  only ever resolve `sent`/`failed`) with `sent_at`/`error`. Transient
  failures retry up to `MAX_EMAIL_RETRIES`; permanent ones don't. "Who's
  in" shows each pending email invite's status, and a failed one offers
  "copy link instead."
- ~~**P1 · Nobody can leave a trip or be removed from one.**~~ — **fixed
  2026-09-28 (P1-B).** Soft-delete only (`planner_memberships.status`:
  `active`/`left`/`removed`) — votes and history never get hard-deleted.
  Self "Leave trip" and organizer "Remove" both in "Who's in"
  (`RosterList.tsx`), plus texting `LEAVE` (single active trip: leaves and
  confirms; several: asks which one first, same as P1-C's routing — `STOP`
  is unaffected, different code path). Leaving/removing withdraws votes on
  still-open decisions only; closed-decision votes stay as history (no
  cost history exists in this app to mark — confirmed, nothing to do
  there). Unbinds them from the trip's group Conversation immediately
  (Twilio's own participant list, not just the DB row, is what actually
  stops texts) and leaves a low-key "X left/was removed" note. The owner
  can't self-leave without transferring the role to another active member
  first (new "Transfer organizer to…" action). A departed member's own
  page access 404s, and they're excluded from nudges/proactive
  texts/tallies/rosters everywhere that's load-bearing for these rules —
  not an exhaustive audit of every membership-existence check in the app
  (that's a larger, lower-urgency hardening pass, not blocking this).
  Re-inviting a left/removed person now correctly flips them back to
  `active` instead of silently no-oping or getting blocked.
- ~~**P1 · Texts from people on several trips go to the trip they joined
  most recently.**~~ — **fixed 2026-09-26 (P1-C).** 1:1 texts now resolve
  by: the message naming a trip (name, destination city, or join code),
  then a 24h active-trip context (also settable with "switch to X"), then
  asking which trip and holding the message until answered — never a
  guess. Every reply is prefixed with the trip name whenever the sender is
  on more than one active trip. One real platform limit found along the
  way, not fully fixable at the app layer: Twilio only allows one phone
  number to be bound to one group Conversation at a time, so a person in
  two trips' group threads can only ever receive one trip's group texts —
  now logged and texted to the organizer when it happens, instead of
  silently dropped.
- **P2 · A single-day overlap is never proposed.** `MIN_WINDOW = 2` in
  `dates.ts`. Setting it to 1 would propose single days, since the
  tie-break already prefers longer windows.
- **P2 · Tied votes go to the first-listed option**, and the summary says
  so. The alternative is to block Close and ask the group to break the tie.
- ~~**P2 · Caps chosen during QA**~~ — **fixed 2026-09-25.** All of them
  moved into `src/config/limits.ts`, single source of truth. Existing:
  trips of at most 60 days, trip names of at most 120 characters,
  availability marks 366 at most, at most 12 places confirmed from one link
  (still drops extras silently, by design). New, didn't exist before: at
  most 30 travelers per trip, 10 options per decision (creation and
  one-at-a-time adds both enforced now — adding used to have no cap at
  all), 10 stay decisions per trip. Every new cap shows a specific message
  naming the limit, not a generic error.
- **P2 · There's no way to delete a decision or remove a stay option,** and
  no way to set nights after creating a stay decision. Without nights,
  per-person prices stay "—".
- **P2 · Mixed currencies:** "best cost" is simply not marked, rather than
  converting between currencies.
- **P2 · Nudges have no cooldown.** Any member can re-text everyone who
  hasn't answered, as often as they like.
- **P2 · The Stays section only shows the newest stay decision.** Older ones
  are reachable from Decisions.

## Security hardening (low risk today, fix before a wider launch)

- **Synthetic phone-login emails are predictable**
  (`phone-<digits>@phone.thatfriend.internal`). Someone could pre-register
  one through the legacy password `/signup`, which would lock that phone
  out. Fix: disable password signups in Supabase, delete `/signup`,
  `/login` and `src/app/auth/*`, and randomize the synthetic email.
- **Join codes use a 3-character suffix,** about 30,000 codes per city, and
  never rotate. Consider 5 or more characters, per-phone failure
  throttling, and a "new code" button.
- **Share and invite links can't be revoked or rotated.**
- **`/api/v2/auth/lookup` says whether an email or phone has an account.**
- **The SSRF guard doesn't cover DNS rebinding** between its own lookup and
  the lookup inside `fetch`. That would need a pinned-IP agent.

## Accessibility

**Fixed 2026-09-25:** the muted greys (`--color-ink-muted`/`--color-ink-faint`
in `globals.css`, formerly `#8C8478`/`#A19A8E`) were 2.3–3.6:1 against the
4.5:1 WCAG AA minimum; darkened to `#615C53`/`#70695D` (4.5–6.5:1 on every
ground) at the same hue/saturation. Also caught and fixed along the way: a
few components had the same two hex values hardcoded instead of referencing
the token (`HeroDemo.tsx`, `TripCover.tsx`, `TravelCard.tsx`,
`preferences/page.tsx`), and the login page's dark preview mockup
(`TripPreviewCard.tsx`) had its own separate muted color (`#7E766C`,
3.4–3.9:1) for the same reason. The e2e a11y check no longer reports a
color-contrast warning on any of the 4 public pages.

**Also fixed 2026-09-25:** the day/avatar tint palette (`DAY_COLORS` in
`itinerary.ts`, plus its separate copies in `cover.ts`'s `COVER_TINTS` and
`guides.ts`'s `TYPE_COLORS`) had 3 of 7 colors — mauve, dusty lilac, ash
rose — at 2.7–3.5:1 as member-avatar-initial backgrounds and text. Darkened
those 3 the same way; the other 4 were already AA-compliant.

## Minor, batch for later

Nothing open right now — the previous batch (UTC "today"/`hasEnded` checks,
`toLocaleDateString(undefined, …)` hydration warnings, the weather
destination split, the trip-name geocode fallback, multi-image MMS,
`addMinutes` midnight clamping, the `/j/<token>` wrong-number Join button,
and `DecisionDetail`'s stale stay-option sidebar) was fixed 2026-09-25.
