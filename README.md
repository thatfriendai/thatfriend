# That Friend

Group trip planning: an organizer creates a trip and shares a link; guests
open the link (no signup) to log preferences and drop pins for places to
stay/eat/see.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth) — organizer accounts only; guests are scoped by
  the trip's unguessable UUID, not a real session (see `supabase/schema.sql`
  for the access-control reasoning)
- Anthropic API — turns a free-text message into a structured preference row
- Google Maps JavaScript API + Places API — place search and the trip map
- Twilio (WhatsApp) — optional. Lets people text preferences straight to a
  WhatsApp number instead of using the web form, and lets anyone send a
  manual reminder to connected-but-unanswered participants.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql) — it
   creates all the tables (trips, participants, preferences, places,
   place_notes, whatsapp_connect_codes) and RLS policies.
3. In **Authentication → Providers**, email/password is on by default. To
   enable Google login: turn on the **Google** provider and follow Supabase's
   linked instructions to create a Google OAuth client, then paste its
   Client ID/Secret in.
4. In **Authentication → URL Configuration**, add
   `http://localhost:3000/auth/callback` as a redirect URL (and your prod
   URL's `/auth/callback` once deployed).
5. In **Project Settings → API**, copy the Project URL, `anon` public key,
   and `service_role` secret key into `.env.local` (see below).

### 2. Google Maps

1. In the [Google Cloud Console](https://console.cloud.google.com/), enable
   the **Maps JavaScript API** and **Places API (New)** for a project.
2. Create an API key, then restrict it to your domain(s) (HTTP referrers) —
   for local dev add `http://localhost:3000/*`.
3. Put the key in `.env.local`.

### 3. Anthropic

1. Get an API key from the [Anthropic Console](https://console.anthropic.com).
2. Put it in `.env.local`.
3. The extraction system prompt is a placeholder at
   [`src/lib/claude/extraction-prompt.ts`](src/lib/claude/extraction-prompt.ts)
   — swap in the real one there.

### 4. Twilio (WhatsApp) — optional

Skip this if you don't need WhatsApp yet; the app works fine without it (the
"Connect WhatsApp" section just won't appear, and the nudge button will say
it's not configured).

1. Create a [Twilio account](https://www.twilio.com/try-twilio). Copy your
   **Account SID** and **Auth Token** from the console dashboard.
2. For testing, use Twilio's **WhatsApp Sandbox**
   (Messaging → Try it out → Send a WhatsApp message) — it gives you a
   shared sandbox number and a "join `<word>`" code. Anyone who wants to
   text the sandbox (including you, while testing) has to send that
   "join `<word>`" message to the sandbox number first — that's a
   one-time Twilio sandbox quirk, not something this app can skip.
   For production, you'd instead register your own number as a WhatsApp
   Sender, which needs Meta business verification.
3. In the Twilio console, set the sandbox's (or your Sender's)
   **"When a message comes in" webhook** to
   `https://<your-domain>/api/whatsapp`, method **POST**.
   - Twilio can't reach `localhost` directly. For local testing, run a
     tunnel (e.g. `ngrok http 3000`) and use the tunnel's HTTPS URL here —
     and keep it in sync if the tunnel URL changes.
4. Put the Account SID, Auth Token, and the sandbox/Sender's WhatsApp
   number (as `whatsapp:+1...`) in `.env.local`.

The webhook verifies every incoming request's Twilio signature against
`TWILIO_AUTH_TOKEN` and the exact webhook URL — if that URL doesn't match
what's configured in Twilio (e.g. behind a different tunnel or proxy),
requests get rejected as invalid rather than silently processed.

### 5. Environment variables

Copy the example file and fill in the values from the steps above:

```bash
cp .env.local.example .env.local
```

| Variable | Where it's used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client (browser + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client (browser + server), RLS-respecting |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only — powers guest access to trip data, bypasses RLS |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Places Autocomplete + map |
| `ANTHROPIC_API_KEY` | Preference extraction |
| `NEXT_PUBLIC_SITE_URL` | Builds the Google OAuth redirect URL |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Sending nudges + verifying inbound webhook signatures |
| `TWILIO_WHATSAPP_NUMBER` | The `whatsapp:+1...` sender Twilio gave you |
| `NEXT_PUBLIC_WHATSAPP_DISPLAY_NUMBER` | Human-readable form shown in the UI |

`.env.local` is gitignored — it never gets committed.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How access control works

There's no guest auth. A trip's shareable link is just `/trip/<uuid>` — the
UUID (122 bits of entropy) is the access token. All guest-facing reads and
writes go through Next.js Server Actions using the Supabase **service role**
key (server-only, bypasses RLS), scoped explicitly by the trip id in the URL.
RLS is enabled on every table with policies that only cover the organizer's
own authenticated actions (creating a trip, listing "my trips"), so the
public anon key can't be used to enumerate or read other people's trips
directly against the Supabase REST API.
