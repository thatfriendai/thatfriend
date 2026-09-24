# Known issues

These were found in QA and deliberately not fixed yet, each with the reason.
Every item needs either a product decision or a console change, or it's
low-impact enough to batch for later. Check this list before a friends
round. Anything a tester is likely to hit should also be mentioned in
BETA_GUIDE.md.

Last full sweep: 2026-09-23. Last sweep: 2026-09-24 (marketing homepage rebuild and new icons; no app areas changed since the full sweep).

## Needs a console or config change (do these before the next round)

| What | Where |
| --- | --- |
| Set `CRON_SECRET`. Without it the cron routes return 401 and stop running. | Vercel env: Production and Preview |
| Set `META_APP_SECRET`. Without it production rejects every WhatsApp webhook with a 403. | Vercel env, taken from Meta App settings → Basic → App secret |
| Run `supabase/migrations/2026-09-23-qa-hardening.sql`, which adds the OTP `attempts` column. Until it runs, one wrong code guess deletes the code, which is safe but annoying. | Supabase SQL editor, on staging and production |
| The auth redirect allow-list must accept `/api/v2/auth/callback` with any query string. The callback URL now also carries `next`. | Supabase → Auth → URL Configuration |
| **Magic links fail when opened in a different browser** from the one that asked for them. PKCE keeps the verifier in the requesting browser's cookie, so a link opened from the Gmail or iOS Mail in-app browser shows "Could not sign in". The fix is to switch the email template to `token_hash` and call `verifyOtp` in the callback. | Supabase email template, plus `src/app/api/v2/auth/callback/route.ts` |

## Needs a product decision

- **P1 · Email invitees never get anything.** `/api/v2/trips/[id]/invites`
  stores email invites and returns `delivered: true`, but nothing sends an
  email. Options: send via Supabase `signInWithOtp`, add a real mailer, or
  remove email invites from the new-trip form.
- **P1 · Nobody can leave a trip or be removed from one.** There's no route
  for either. A tester who joins the wrong trip is stuck there.
- **P1 · Texts from people on several trips go to the trip they joined most
  recently.** A Lisbon restaurant texted by someone who later joined Miami
  lands in Miami, with a "doesn't look nearby" warning. Options: route to
  the nearest trip, or ask "which trip?".
- **P2 · A single-day overlap is never proposed.** `MIN_WINDOW = 2` in
  `dates.ts`. Setting it to 1 would propose single days, since the
  tie-break already prefers longer windows.
- **P2 · Tied votes go to the first-listed option**, and the summary says
  so. The alternative is to block Close and ask the group to break the tie.
- **P2 · Caps chosen during QA:**
  - trips of at most 60 days
  - trip names of at most 120 characters
  - availability marks from 1 year back to 2 years ahead, 366 at most
  - at most 12 places confirmed from one link

  The last one drops extras silently.
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

- **Colour contrast:** the muted greys (`#8C8478` and `#A19A8E` on the cream
  backgrounds) measure 2.3–3.6:1 against the 4.5:1 WCAG AA minimum. They're
  used for hints, captions and small labels on every page. This needs one
  design-token change, not a per-page fix. The e2e a11y check reports it as
  a warning instead of failing.

## Minor, batch for later

- The trip page's `hasEnded` and a few server-rendered "today" checks use
  the UTC date, so for a few hours each evening in the US the past/upcoming
  split is off.
- `toLocaleDateString(undefined, …)` in components that are also rendered
  on the server can cause a hydration warning for non-en-US browsers.
- Weather looks up `destination.split(",")[0]`, so "Portland, Maine"
  becomes Portland, OR.
- Trips with no destination geocode pasted places against the trip *name*,
  so they get spurious "doesn't look nearby" warnings.
- Only the first image in an MMS is read. Screenshots 2 through N are
  dropped.
- `travel.ts` `addMinutes` clamps at midnight, so a 01:00 departure suggests
  "heading off at 00:00".
- On `/j/<token>`, a signed-in user whose account has a *different* number
  still sees the Join button. Tapping it shows the "this invite is for
  another number" message. Accounts with no phone yet are let in on
  purpose; see `acceptInviteToken`.
- A stay option pasted after the decision page loaded isn't in
  DecisionDetail's sidebar summary until the page is reloaded.
