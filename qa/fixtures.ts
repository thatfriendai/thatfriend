/**
 * The cast and the trips every QA pass runs through — unit tests import
 * these, the e2e suite seeds from them, and the QA agent
 * (.claude/skills/qa/SKILL.md) walks the matrix in docs/qa/SCENARIOS.md
 * using the same names, so a bug report can say "Deniz on the Lisbon trip"
 * and everyone knows exactly which setup that is.
 *
 * Each persona exists because it breaks an assumption the happy path makes
 * (a US phone, a desktop browser, an English name, someone who answers).
 * Add one whenever a friend hits a bug that none of these would have.
 */

export interface Persona {
  id: string;
  name: string;
  /** As the person would type it, not normalized — normalization is what's under test. */
  phone: string | null;
  email: string | null;
  timezone: string;
  device: "iphone-safari" | "iphone-imessage-webview" | "android-chrome" | "desktop-chrome" | "desktop-safari";
  channel: "web" | "sms" | "both";
  /** The assumption this person breaks. */
  breaks: string;
}

export const PEOPLE = {
  organizer: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Maya Chen",
    phone: "+1 (415) 555-0101",
    email: "maya@example.com",
    timezone: "America/Los_Angeles",
    device: "iphone-safari",
    channel: "both",
    breaks: "Nothing — the happy path. If Maya fails, stop and fix before anything else.",
  },
  newbie: {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Jordan",
    phone: "415-555-0102",
    email: null,
    timezone: "America/New_York",
    device: "iphone-imessage-webview",
    channel: "web",
    breaks: "Has no account and opens the invite inside iMessage's in-app browser (no saved logins, cookies can drop).",
  },
  smsOnly: {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Sam Okafor",
    phone: "4155550103",
    email: null,
    timezone: "America/Chicago",
    device: "android-chrome",
    channel: "sms",
    breaks: "Never opens the web app — everything happens over text, including forwarding links and asking questions.",
  },
  international: {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Deniz Yılmaz",
    phone: "+90 532 555 0104",
    email: "deniz@example.com",
    timezone: "Europe/Istanbul",
    device: "android-chrome",
    channel: "web",
    breaks: "Non-US number (SMS is US-only) and a timezone ahead of UTC, where date-only strings shift a day.",
  },
  ukFriend: {
    id: "00000000-0000-4000-8000-000000000005",
    name: "Olivia Hart",
    phone: "07700 900105",
    email: "olivia@example.co.uk",
    timezone: "Europe/London",
    device: "iphone-safari",
    channel: "web",
    breaks: "Types a national-format number with no country code — must not be mistaken for a US number.",
  },
  flaky: {
    id: "00000000-0000-4000-8000-000000000006",
    name: "Alex",
    phone: "+1 415 555 0106",
    email: "alex1@example.com",
    timezone: "America/Los_Angeles",
    device: "iphone-safari",
    channel: "web",
    breaks: "Joins and then never answers anything — every 'waiting on N people' and nudge path runs through Alex.",
  },
  sameName: {
    id: "00000000-0000-4000-8000-000000000007",
    name: "Alex",
    phone: "+1 415 555 0107",
    email: "alex2@example.com",
    timezone: "America/Denver",
    device: "desktop-chrome",
    channel: "web",
    breaks: "Shares a first name with another member — anything keyed or displayed by name alone collides.",
  },
  unicodeName: {
    id: "00000000-0000-4000-8000-000000000008",
    name: "Zoë-Marie Nguyễn O'Sullivan 🌸",
    phone: "+1 415 555 0108",
    email: "zoe@example.com",
    timezone: "Pacific/Honolulu",
    device: "iphone-safari",
    channel: "both",
    breaks: "Long name with accents, an apostrophe and emoji — truncation, avatars, initials and SMS encoding.",
  },
  lateJoiner: {
    id: "00000000-0000-4000-8000-000000000009",
    name: "Priya Raman",
    phone: "+1 415 555 0109",
    email: "priya@example.com",
    timezone: "America/New_York",
    device: "desktop-safari",
    channel: "web",
    breaks: "Joins after dates are locked and a decision is closed — must see results, not a blank form.",
  },
  accessibility: {
    id: "00000000-0000-4000-8000-000000000010",
    name: "Chris Lee",
    phone: "+1 415 555 0110",
    email: "chris@example.com",
    timezone: "America/Los_Angeles",
    device: "iphone-safari",
    channel: "web",
    breaks: "Uses VoiceOver, 200% text size and reduced motion — icon-only buttons, confetti and tiny tap targets.",
  },
} satisfies Record<string, Persona>;

export type PersonaKey = keyof typeof PEOPLE;

export interface TripScenario {
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  members: PersonaKey[];
  /** What this trip shape stresses. */
  breaks: string;
}

export const TRIPS = {
  weekend: {
    name: "Austin weekend",
    destination: "Austin, TX, USA",
    start_date: "2026-10-16",
    end_date: "2026-10-18",
    members: ["organizer", "newbie", "smsOnly", "flaky"],
    breaks: "Baseline 3-day US trip with a mix of web and SMS people.",
  },
  international: {
    name: "Lisbon in the fall",
    destination: "Lisbon, Portugal",
    start_date: "2026-11-05",
    end_date: "2026-11-12",
    members: ["organizer", "international", "ukFriend", "unicodeName"],
    breaks: "Members in 4 timezones, 2 non-US phones, a destination ahead of every member.",
  },
  noDatesYet: {
    name: "Somewhere warm in Feb",
    destination: null,
    start_date: null,
    end_date: null,
    members: ["organizer", "flaky"],
    breaks: "No destination and no dates — every view must have a real empty state, not 'null' or 'Invalid Date'.",
  },
  dayTrip: {
    name: "Napa day",
    destination: "Napa, CA, USA",
    start_date: "2026-10-24",
    end_date: "2026-10-24",
    members: ["organizer", "sameName", "flaky"],
    breaks: "Start == end: one-day itinerary, 'Oct 24–24' style labels, 2-day minimum windows.",
  },
  newYears: {
    name: "NYE in CDMX",
    destination: "Mexico City, Mexico",
    start_date: "2026-12-30",
    end_date: "2027-01-02",
    members: ["organizer", "newbie", "lateJoiner"],
    breaks: "Crosses a year boundary — labels that drop the year, sorting by month, 'past vs upcoming'.",
  },
  dstWeekend: {
    name: "Halloween in New Orleans",
    destination: "New Orleans, LA, USA",
    start_date: "2026-10-30",
    end_date: "2026-11-02",
    members: ["organizer", "smsOnly", "international"],
    breaks: "US clocks fall back Nov 1 — day arithmetic done in ms/86400000 comes out fractional.",
  },
  longTrip: {
    name: "Japan, three weeks",
    destination: "Tokyo, Japan",
    start_date: "2027-03-20",
    end_date: "2027-04-10",
    members: ["organizer", "accessibility"],
    breaks: "22 days: longer than the 10-day proposal window, more days than day colors, long itinerary lists.",
  },
  bigGroup: {
    name: "Nashville bachelorette",
    destination: "Nashville, TN, USA",
    start_date: "2027-05-14",
    end_date: "2027-05-16",
    members: ["organizer", "newbie", "smsOnly", "international", "ukFriend", "flaky", "sameName", "unicodeName", "lateJoiner", "accessibility"],
    breaks: "10 people: avatar stacks overflow, group texts get noisy, 'works for N of M' math, same-name members.",
  },
  solo: {
    name: "Just me in Kraków",
    destination: "Kraków, Poland",
    start_date: "2026-10-09",
    end_date: "2026-10-12",
    members: ["organizer"],
    breaks: "A group-trip app with a group of one — nudges, votes and 'waiting on' must not divide by zero or nag.",
  },
  accented: {
    name: "İstanbul & São Paulo",
    destination: "İstanbul, Türkiye",
    start_date: "2027-06-01",
    end_date: "2027-06-06",
    members: ["organizer", "international"],
    breaks: "Non-ASCII destination: slugs, join codes, search, OG images.",
  },
  pastTrip: {
    name: "Tahoe last winter",
    destination: "Lake Tahoe, CA, USA",
    start_date: "2026-02-13",
    end_date: "2026-02-16",
    members: ["organizer", "flaky", "sameName"],
    breaks: "Already over — reviews, ratings, lessons and 'copy this trip' paths.",
  },
} satisfies Record<string, TripScenario>;

export type TripKey = keyof typeof TRIPS;

/**
 * Real-world things people text That Friend, grouped by what the router
 * should do with them. The deterministic subset (greetings) is unit-tested;
 * the rest is the golden set for `npm run eval:intent`, which needs an
 * Anthropic key because it exercises the actual classifier prompt.
 */
export const INBOUND_TEXTS: { text: string; hasTrips: boolean; expect: string; note?: string }[] = [
  // add_place — the default, and almost all real traffic
  { text: "https://maps.app.goo.gl/abc123XYZ", hasTrips: true, expect: "add_place" },
  { text: "we HAVE to go here https://www.tiktok.com/@eater/video/7300000000000000000", hasTrips: true, expect: "add_place" },
  { text: "Franco Manca on Chiswick high rd, get the sourdough", hasTrips: true, expect: "add_place" },
  { text: "Time Out Market 🍷", hasTrips: true, expect: "add_place", note: "emoji-only context" },
  { text: "https://www.airbnb.com/rooms/12345678?check_in=2026-11-05&guests=4&utm_source=copy", hasTrips: true, expect: "add_place", note: "tracking params" },
  { text: "Pastéis de Belém", hasTrips: true, expect: "add_place", note: "accented place name alone" },
  // question
  { text: "what are we doing saturday?", hasTrips: true, expect: "question:day" },
  { text: "day 2??", hasTrips: true, expect: "question:day" },
  { text: "how much is the airbnb per person", hasTrips: true, expect: "question:lodging_cost" },
  { text: "is this trip gonna be expensive", hasTrips: true, expect: "question:budget" },
  { text: "did everyone confirm?", hasTrips: true, expect: "question:roster" },
  { text: "who's in", hasTrips: true, expect: "question:roster" },
  // nudge / close
  { text: "can you remind everyone to vote", hasTrips: true, expect: "nudge" },
  { text: "lock in the hotel one", hasTrips: true, expect: "close_decision" },
  // start_trip
  { text: "start a trip to Lisbon in March", hasTrips: true, expect: "start_trip" },
  { text: "lisbon in march", hasTrips: false, expect: "start_trip", note: "no trips yet, so a destination is a new trip" },
  { text: "somewhere warm in feb w/ 3 friends", hasTrips: false, expect: "start_trip" },
  // chat
  { text: "hey", hasTrips: true, expect: "chat" },
  { text: "Hi, it's my first time using That Friend", hasTrips: false, expect: "chat" },
  { text: "thanks!!", hasTrips: true, expect: "chat" },
  { text: "lol ok", hasTrips: true, expect: "chat" },
  { text: "merhaba!", hasTrips: false, expect: "chat", note: "non-English greeting" },
];
