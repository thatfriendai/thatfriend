# Scenarios

These are the journeys a friend actually takes, written so a person or the QA
agent can walk them and know whether each one passed. The personas and trips
come from [`qa/fixtures.ts`](../../qa/fixtures.ts).

**How to use this doc:**
- **Before a friends round**, run every journey (J1 to J11).
- **For a PR**, run the journeys whose "touches" list includes a file you
  changed.
- **At each step**, check the expected result. Also look for things nobody
  wrote down:
  - wrong names
  - a raw `undefined`
  - a button that stays disabled
  - a text going to the wrong person

---

## Critical journeys

### J1 · Organizer starts a trip on the web
**Persona:** Maya · **Trip:** weekend, noDatesYet, accented
**Touches:** `planner/trips/new/*`, `api/v2/trips/route.ts`, `lib/planner/tokens.ts`, `slug.ts`

1. Create a trip with a destination and no dates.
   - Expected: you land on the trip page.
   - Expected: the header shows no "Invalid Date".
   - Expected: the join code is textable, meaning there's no 0, O, 1, I or L.
2. Create one with a date range that crosses a month boundary.
   - Expected: the header reads "Sep 28–Oct 3", not "SEP 28–3".
3. Double-tap Create on a slow network (DevTools → Slow 3G).
   - Expected: exactly one trip is created.
4. Submit with end before start, or a 90-day range.
   - Expected: a friendly message, not a 500.

### J2 · Friend joins from an invite link
**Persona:** Jordan (in-app browser), Olivia, Priya · **Trip:** weekend, bigGroup
**Touches:** `j/*`, `planner/join/*`, `api/v2/join/*`, `lib/planner/joinLink.ts`, `joinPreview.ts`

1. Open the link from a text while signed out.
   - Expected: the preview shows the trip name, the organizer's first name and the dates.
2. Sign in.
   - Expected: you're returned to the trip, not dumped on Home.
3. Open the same link again.
   - Expected: "You're already in", with no duplicate membership.
4. Open a link with its last character cut off, or with a trailing ".".
   - Expected: a friendly "link doesn't work" page.
5. Forward a per-phone invite to someone else and have them open it.
   - Expected: it doesn't let them in.
6. Priya joins after dates are locked and a decision is closed.
   - Expected: she sees the results, not blank forms.

### J3 · Joining and saving places by text only
**Persona:** Sam (SMS only) · **Trip:** weekend, dstWeekend
**Touches:** `api/v2/twilio/*`, `lib/planner/{inboundIntent,smsVoice,consent,invitePhone,whatsappResource,fetchPage,extract}.ts`

Simulate each text with `node scripts/simulate-inbound.mjs <from> "<text>"` (local by default).

1. "hey" from an unknown number.
   - Expected: the "sign in at …" reply.
2. "hey" from an invited number.
   - Expected: "Maya invited you … reply 1".
3. Reply "1" or "START".
   - Expected: joined, with one reply.
4. "hi sarah" and "hello again".
   - Expected: a greeting, not "that code doesn't match".
5. Forward a Maps short link.
   - Expected: the place is pinned at the right spot.
6. Forward the same link again.
   - Expected: "already had that one".
7. "must go 🍷 https://vm.tiktok.com/ZMabc/".
   - Expected: the link is fetched and the caption is used.
8. "what are we doing saturday?", "who's in", "is this gonna be expensive".
   - Expected: a sensible answer for each.
9. "mum +44 20 7946 0958".
   - Expected: nobody is texted.
10. "STOP", then "lol ok".
    - Expected: the sender stays opted out.
11. "START".
    - Expected: opted back in, with one reply.
12. Send a contact card (vCard) or a voice memo.
    - Expected: "I can only read text, links, and photos".

### J4 · The group text thread
**Persona:** Maya, Sam, Zoë-Marie · **Trip:** weekend
**Touches:** `api/v2/twilio/conversation/route.ts`, `lib/twilio/conversations.ts`, `consent.ts`

1. Start the group thread from the trip page.
   - Expected: one opener, which names the organizer.
2. Someone texts "yes" or "cancel" in the group.
   - Expected: no opt-in or opt-out message is posted to everyone.
3. Someone in the thread texts "join MIAMI4K".
   - Expected: they join the other trip, and the reply comes privately.
4. Forward 12 places at once.
   - Expected: the reply stays under 1,600 characters and doesn't fail silently.

### J5 · Finding dates
**Persona:** everyone, especially Deniz (UTC+3) and Maya (UTC−7) · **Trip:** weekend, newYears, dayTrip, longTrip, solo
**Touches:** `planner/trips/[id]/dates/*`, `DatesModal.tsx`, `lib/planner/{dates,datesView,calendarDate}.ts`, `api/v2/trips/[id]/{availability,dates}/*`

1. Each member marks their days.
   - Expected: the heatmap counts are right.
   - Expected: the proposal says "works for all N" or "N of M".
2. Deniz marks Oct 9–11.
   - Expected: Maya sees exactly Oct 9–11, not Oct 8–10.
3. Save inside the modal.
   - Expected: the modal updates without closing.
4. As the owner, click Confirm twice quickly.
   - Expected: the group gets one text.
5. Unlock and move the dates.
   - Expected: the itinerary shows only the new days.
   - Expected: the old days' items aren't in "The plan so far".
6. Open the page at 9pm Pacific the day before the trip.
   - Expected: it says "tomorrow", not "today".
7. Marks from last month don't drive the proposal.
8. Try marks spanning 5 years through the API.
   - Expected: a 400, and the page doesn't freeze.

### J6 · Planning days and places
**Persona:** Maya, Alex + Alex · **Trip:** weekend, longTrip
**Touches:** `ItineraryBoard.tsx`, `PlacesBoard.tsx`, `AddPlaceModal.tsx`, `api/v2/trips/[id]/{places,itinerary,days}/*`

1. Add an item with Enter, then click away.
   - Expected: one item, not two.
2. Look at the map pins on day 3.
   - Expected: they're numbered 1, 2, 3, not 7, 8, 9.
3. Two people accept draft days at the same time.
   - Expected: no place lands on both days.
4. Delete a place that has ratings.
   - Expected: a confirmation that names the place and says the ratings go too.
5. Alex #1 views "Added by me".
   - Expected: Alex #2's places don't show up there.

### J7 · Decisions and stays
**Persona:** bigGroup members · **Trip:** bigGroup, international
**Touches:** `decisions/**`, `StaysSection.tsx`, `StayMatrix.tsx`, `api/v2/trips/[id]/decisions/**`, `lib/planner/stayComparison.ts`

1. Start "Where to stay", paste a listing, then vote straight away.
   - Expected: no crash.
   - Expected: Close is enabled.
2. Tie the vote 2–2 and close it.
   - Expected: the winner is the first-listed option, and the summary says it was a tie.
3. Two people close at the same moment.
   - Expected: one notification.
4. "Already booked" with the cost "$1,296" and a note.
   - Expected: the cost and the note are both saved.
5. Compare a € option with a $ option.
   - Expected: neither is marked "best cost".
6. Have two stay decisions.
   - Expected: both can be reached from the trip page.

### J8 · Preferences and convergence
**Persona:** everyone · **Trip:** bigGroup, solo
**Touches:** `preferences/*`, `convergence/*`, `ConvergenceModal.tsx`, `api/v2/trips/[id]/preferences/*`

1. Ten people all leave the budget at the default.
   - Expected: the dots don't run off the bar, and there's no sideways scroll on a phone.
2. Submit a negative or huge budget through the API.
   - Expected: it's clamped.
3. Look at the solo trip.
   - Expected: no nudges, and no "waiting on 0 people".

### J9 · After the trip
**Persona:** Maya, Alex · **Trip:** pastTrip
**Touches:** `reviews/*`, `api/v2/trips/[id]/{review,lessons,places/*/rating}/*`, `api/v2/cron/rating-prompts`

1. Rate places.
   - Expected: if the save fails, the page says so. It never shows "Saved".
2. Press Enter twice on a lesson.
   - Expected: it's saved once.
3. Copy the trip.
   - Expected: the new trip has no stale dates.

### J10 · Accounts
**Persona:** Maya, Sam · **Trip:** none
**Touches:** `planner/login/*`, `planner/profile/*`, `api/v2/auth/*`, `api/v2/users/*`, `lib/planner/{session,plannerUser,emailLink,phoneSession}.ts`

1. Sign in by phone code, then enter a wrong code 6 times.
   - Expected: locked out; request a new code.
2. Ask for a code twice within a minute.
   - Expected: the second request is politely refused.
3. As a phone-only user, add an email in the profile and click the link in the same browser.
   - Expected: the accounts are linked.
4. Signed in as Maya, open /planner/login and verify Sam's phone.
   - Expected: you become Sam.
   - Expected: Sam's account is **not** merged into Maya's.
5. Link a phone that has its own ratings and trips.
   - Expected: nothing disappears.
6. Visit /planner/u/MAYA.
   - Expected: the profile loads.

### J11 · Access control (run with two browsers)
**Persona:** Priya (not a member) vs Maya · **Trip:** solo
**Touches:** every `api/v2/trips/[id]/**` route

1. Priya opens `/planner/trips/<solo id>`.
   - Expected: a 404.
2. Priya replays Maya's API calls with her own cookie (DevTools → Copy as fetch): PATCH the trip, add a place, vote, lock dates.
   - Expected: every one returns 403 or 404.
3. Call the cron routes without `CRON_SECRET`.
   - Expected: a 401.
4. POST to the WhatsApp webhook without a signature.
   - Expected: a 403.

---

## Interruptions (try these on every journey)

Friends don't use the app in a straight line. On each journey, try at least
two of these:

- Double-tap every submit button.
- Use the back button right after a save.
- Background the app mid-save, then come back.
- Throttle to Slow 3G, then go offline mid-request.
- Open the same trip in two tabs, change something in one, and act in the other.
- Rotate the phone, and set the system text size to 200%.
- Switch the device's timezone to Europe/Istanbul and to Pacific/Honolulu.
- Paste in emoji, RTL text (مرحبا), a 300-character name, and `<script>`.

## Persona × trip matrix

Each ● is a trip that persona is a member of. The e2e persona spec checks
that every trip screen renders sensibly for every ●. The walkthroughs
(J1–J11) cover everything that needs judgement, like SMS replies or who gets
notified.

| | weekend | international | noDatesYet | dayTrip | newYears | dstWeekend | longTrip | bigGroup | solo | accented | pastTrip |
|---|---|---|---|---|---|---|---|---|---|---|---|
| organizer | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| newbie | ● | | | | ● | | | ● | | | |
| smsOnly | ● | | | | | ● | | ● | | | |
| international | | ● | | | | ● | | ● | | ● | |
| ukFriend | | ● | | | | | | ● | | | |
| flaky | ● | | ● | ● | | | | ● | | | ● |
| sameName | | | | ● | | | | ● | | | ● |
| unicodeName | | ● | | | | | | ● | | | |
| lateJoiner | | | | | ● | | | ● | | | |
| accessibility | | | | | | | ● | ● | | | |
