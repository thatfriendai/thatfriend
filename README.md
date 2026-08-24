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

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql) — it
   creates the four tables and RLS policies.
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

### 4. Environment variables

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
