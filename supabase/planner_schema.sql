-- "That Friend" v2 — the bigger product spec (trips w/ real membership,
-- structured per-trip preferences, convergence, decisions/votes, resources,
-- WhatsApp via Meta). Lives in its own `planner_`-prefixed tables so it can
-- run side by side with the original trips/participants/preferences/places
-- system without colliding — nothing here touches or reads those tables.
--
-- Run this in the Supabase SQL Editor, in addition to (not instead of)
-- supabase/schema.sql.
--
-- Phase 1 only: users, trips, memberships, invites. Later phases (Day,
-- ItineraryItem, Decision, Option, Vote, Note, Resource, Place) come as
-- their own migrations once we get there.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- planner_users
--
-- Not the same as Supabase auth.users. Email-identified members sign in
-- through Supabase Auth (magic link) and get `auth_user_id` set — that's
-- how we reuse Supabase's existing email delivery instead of standing up a
-- separate mailer. Phone-identified members are just data for now (added
-- via an invite, trackable) until Phase 6 wires up WhatsApp-code sign-in;
-- until then a phone-only row has no way to log back in, which is expected.
-- ---------------------------------------------------------------------------
create table if not exists planner_users (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text unique,
  phone text unique,
  whatsapp_opt_in boolean not null default false,
  auth_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint planner_users_identity check (email is not null or phone is not null)
);

create unique index if not exists planner_users_auth_user_id_idx
  on planner_users (auth_user_id) where auth_user_id is not null;

-- ---------------------------------------------------------------------------
-- planner_trips
-- ---------------------------------------------------------------------------
create table if not exists planner_trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text,
  start_date date,
  end_date date,
  occasion text,
  budget_band text,
  -- Chosen once by the creator, applies to everyone — changes what the
  -- convergence endpoint returns, not just how the client renders it.
  privacy text not null default 'private' check (privacy in ('private', 'open')),
  created_by uuid not null references planner_users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- planner_memberships
-- ---------------------------------------------------------------------------
create table if not exists planner_memberships (
  trip_id uuid not null references planner_trips (id) on delete cascade,
  user_id uuid not null references planner_users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index if not exists planner_memberships_user_idx on planner_memberships (user_id);

-- ---------------------------------------------------------------------------
-- planner_invites
-- ---------------------------------------------------------------------------
create table if not exists planner_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  token text not null unique,
  channel text not null check (channel in ('email', 'sms', 'link')),
  sent_to text,
  accepted_by uuid references planner_users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Real delivery state for an email invite (P1-A) — "delivered"/"bounced"
  -- need a Resend webhook to ever be set; a synchronous send only ever
  -- resolves to "sent" or "failed" on its own. Link/sms-channel rows stay
  -- "pending" forever; nothing reads status for those.
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  sent_at timestamptz,
  error text
);

create index if not exists planner_invites_trip_idx on planner_invites (trip_id);

-- ---------------------------------------------------------------------------
-- planner_preferences — Phase 2. Scoped to (trip_id, user_id), never
-- global: the whole product promise is that a cheap week with one group
-- doesn't follow you to the next trip.
-- ---------------------------------------------------------------------------
create table if not exists planner_preferences (
  trip_id uuid not null references planner_trips (id) on delete cascade,
  user_id uuid not null references planner_users (id) on delete cascade,
  stay_max integer,
  flight_max integer,
  food_max integer,
  pace text check (pace in ('Slow', 'Balanced', 'Packed')),
  interests text[] not null default '{}',
  non_negotiable text,
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- ---------------------------------------------------------------------------
-- planner_days — Phase 3. One row per calendar date in the trip's range,
-- backfilled lazily the first time the trip doc is opened (see
-- src/lib/planner/days.ts). Deleting a trip cascades; there's no user-facing
-- delete for a single day.
-- ---------------------------------------------------------------------------
create table if not exists planner_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  date date not null,
  city text,
  color text not null,
  unique (trip_id, date)
);

create index if not exists planner_days_trip_idx on planner_days (trip_id);

-- ---------------------------------------------------------------------------
-- planner_itinerary_items — freeform lines on a day, ordered by `position`.
-- ---------------------------------------------------------------------------
create table if not exists planner_itinerary_items (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references planner_days (id) on delete cascade,
  trip_id uuid not null references planner_trips (id) on delete cascade,
  text text not null,
  position integer not null default 0,
  created_by uuid references planner_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists planner_itinerary_items_day_idx on planner_itinerary_items (day_id);

-- ---------------------------------------------------------------------------
-- planner_places — the "Notes and finds" list. `map_x`/`map_y` are stable
-- pseudo-random percentages (see hashPercent in src/lib/planner/itinerary.ts)
-- rather than real geocoding — Phase 3 has no map provider wired up yet, so
-- the map is a stylized backdrop and pins just need to stay put and not
-- collide. `day_id` is nullable: a place can be saved before it's scheduled.
-- ---------------------------------------------------------------------------
create table if not exists planner_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  day_id uuid references planner_days (id) on delete set null,
  name text not null,
  kind text not null check (kind in ('Restaurants', 'Coffee shops', 'Bars', 'Museums', 'Activities', 'Other')),
  note text,
  map_x numeric not null,
  map_y numeric not null,
  added_by uuid references planner_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists planner_places_trip_idx on planner_places (trip_id);

-- Real coordinates, added once map_x/map_y (a stable pseudo-random position,
-- never real geography) got swapped for an actual map. Nullable: existing
-- rows predate this and only get lat/lng if re-added or backfilled.
alter table planner_places add column if not exists lat double precision;
alter table planner_places add column if not exists lng double precision;
alter table planner_places add column if not exists address text;

-- Widens the kind check for tables created before "Coffee shops" existed —
-- drop-then-recreate is the only way to alter a check constraint's allowed
-- values, safe to re-run since it doesn't touch any data.
alter table planner_places drop constraint if exists planner_places_kind_check;
alter table planner_places add constraint planner_places_kind_check
  check (kind in ('Restaurants', 'Coffee shops', 'Bars', 'Museums', 'Activities', 'Other'));

-- ---------------------------------------------------------------------------
-- planner_resources — Phase 4. Where a batch of places came from: a pasted
-- link, pasted text (e.g. a forwarded WhatsApp message), or an uploaded
-- screenshot. Created up front when extraction runs, independent of how
-- many (if any) of the candidates the user actually keeps — the resource
-- itself is the record of "this was submitted."
-- ---------------------------------------------------------------------------
create table if not exists planner_resources (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  type text not null check (type in ('link', 'text', 'screenshot')),
  label text not null,
  source_url text,
  added_by uuid references planner_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists planner_resources_trip_idx on planner_resources (trip_id);

-- planner_places.resource_id — added after planner_resources so a place
-- extracted from a link/text/screenshot can point back to its source. Null
-- for places entered by hand.
alter table planner_places add column if not exists resource_id uuid references planner_resources (id) on delete set null;

-- ---------------------------------------------------------------------------
-- planner_decisions / planner_decision_options / planner_decision_votes /
-- planner_decision_notes — Phase 5. A decision has 2+ options; each member
-- casts at most one vote per decision (re-voting overwrites, enforced by the
-- primary key on (decision_id, user_id)). `decided_option_id` is set when
-- the decision is closed — the option with the most votes at close time,
-- computed in the route handler rather than in SQL.
-- ---------------------------------------------------------------------------
create table if not exists planner_decisions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  title text not null,
  why text,
  status text not null default 'open' check (status in ('open', 'closed')),
  decided_option_id uuid,
  created_by uuid references planner_users (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists planner_decisions_trip_idx on planner_decisions (trip_id);

create table if not exists planner_decision_options (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references planner_decisions (id) on delete cascade,
  trip_id uuid not null references planner_trips (id) on delete cascade,
  label text not null,
  sub text,
  cost text,
  fors text[] not null default '{}',
  against text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists planner_decision_options_decision_idx on planner_decision_options (decision_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planner_decisions_decided_option_fk'
  ) then
    alter table planner_decisions
      add constraint planner_decisions_decided_option_fk
      foreign key (decided_option_id) references planner_decision_options (id) on delete set null;
  end if;
end $$;

create table if not exists planner_decision_votes (
  decision_id uuid not null references planner_decisions (id) on delete cascade,
  option_id uuid not null references planner_decision_options (id) on delete cascade,
  user_id uuid not null references planner_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (decision_id, user_id)
);

create table if not exists planner_decision_notes (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references planner_decisions (id) on delete cascade,
  trip_id uuid not null references planner_trips (id) on delete cascade,
  text text not null,
  created_by uuid references planner_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists planner_decision_notes_decision_idx on planner_decision_notes (decision_id);

-- ---------------------------------------------------------------------------
-- planner_whatsapp_codes — Phase 6. A short-lived sign-in code texted to a
-- phone over WhatsApp; the user types it back into the web form. Verifying
-- deletes the row (single use). Sending a new code for the same phone
-- replaces any unused one rather than accumulating rows.
-- ---------------------------------------------------------------------------
create table if not exists planner_whatsapp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  name text,
  invite_token text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists planner_whatsapp_codes_phone_idx on planner_whatsapp_codes (phone);

-- Wrong guesses against this code; verify-phone deletes the code after 5
-- (a 6-digit code with unlimited guesses is brute-forceable in minutes).
-- Also shipped as supabase/migrations/2026-09-23-qa-hardening.sql.
alter table planner_whatsapp_codes add column if not exists attempts int not null default 0;

-- ---------------------------------------------------------------------------
-- planner_availability_marks — Phase 7. One row per day a member marked as
-- workable for a trip. No exact-dates picker anymore: everyone marks every
-- day that could work, and the group's overlap gets proposed automatically
-- (see src/lib/planner/dates.ts). Locking a proposal writes it straight into
-- planner_trips.start_date/end_date rather than duplicating those columns.
-- ---------------------------------------------------------------------------
create table if not exists planner_availability_marks (
  trip_id uuid not null references planner_trips (id) on delete cascade,
  user_id uuid not null references planner_users (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id, date)
);

create index if not exists planner_availability_marks_trip_idx on planner_availability_marks (trip_id);

-- planner_trips — date-lock and public-share additions for Phase 7.
alter table planner_trips add column if not exists dates_locked_at timestamptz;
alter table planner_trips add column if not exists dates_flagged_by uuid references planner_users (id) on delete set null;
alter table planner_trips add column if not exists dates_flagged_at timestamptz;
alter table planner_trips add column if not exists dates_flag_note text;
alter table planner_trips add column if not exists share_token text unique;

-- planner_trips.twilio_conversation_sid — the trip's group SMS/MMS thread
-- (Twilio Conversations). Null until someone starts it; Twilio is the
-- source of truth for who's actually in the group, this just remembers
-- which Conversation belongs to which trip.
alter table planner_trips add column if not exists twilio_conversation_sid text unique;

-- planner_trips.preferences_skipped_at/_by — lets the owner bypass
-- collecting everyone's preferences when the group has already decided
-- the essentials (an Airbnb, a location) outside the app. Owner-only,
-- reversible (undoing just clears both columns) — same shape as the
-- dates_flagged_by/_at pair above.
alter table planner_trips add column if not exists preferences_skipped_at timestamptz;
alter table planner_trips add column if not exists preferences_skipped_by uuid references planner_users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- planner_item_ratings — Phase 7. Star rating + short note a member leaves
-- on an itinerary line item after the trip. Multiple people can rate the
-- same item; each person rates it at most once (re-rating overwrites).
-- ---------------------------------------------------------------------------
create table if not exists planner_item_ratings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  item_id uuid not null references planner_itinerary_items (id) on delete cascade,
  user_id uuid not null references planner_users (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  unique (item_id, user_id)
);

create index if not exists planner_item_ratings_trip_idx on planner_item_ratings (trip_id);

-- ---------------------------------------------------------------------------
-- planner_trip_reviews — Phase 7. The two trip-level questions on the
-- Reviews screen: would you stay there again, and how did the pace run.
-- ---------------------------------------------------------------------------
create table if not exists planner_trip_reviews (
  trip_id uuid not null references planner_trips (id) on delete cascade,
  user_id uuid not null references planner_users (id) on delete cascade,
  stay_rating smallint check (stay_rating between 1 and 5),
  pace_feedback text check (pace_feedback in ('saw_everything', 'about_right', 'not_enough_time', 'too_packed')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Phase 8 — public profiles & friends (the "trip shelf"). A follow is
-- one-directional so "friends" (mutual follows) can be computed without a
-- separate concept; auto-friending on trip join just inserts both
-- directions at once. username is nullable — auto-slugged on first
-- profile visit, not required to sign up.
-- ---------------------------------------------------------------------------
alter table planner_users add column if not exists username text unique;
alter table planner_users add column if not exists tagline text;
alter table planner_trips add column if not exists is_public boolean not null default false;

create table if not exists planner_follows (
  follower_id uuid not null references planner_users (id) on delete cascade,
  followee_id uuid not null references planner_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists planner_follows_followee_idx on planner_follows (followee_id);

-- ---------------------------------------------------------------------------
-- Phase 8 — lodging comparison matrix. Extends planner_decisions/_options
-- rather than a new table: a lodging decision is still a Decision, just
-- one with `kind = 'lodging'` and its options carrying structured fields
-- alongside (not instead of) the existing free-text sub/cost/fors/against.
-- amenities is [{label, available}] — flexible per listing type, rendered
-- as matrix rows in the order given.
-- ---------------------------------------------------------------------------
alter table planner_decisions add column if not exists kind text not null default 'general'
  check (kind in ('general', 'lodging'));

alter table planner_decision_options add column if not exists option_type text;
alter table planner_decision_options add column if not exists price_per_person_night numeric;
alter table planner_decision_options add column if not exists total_price numeric;
alter table planner_decision_options add column if not exists bedrooms integer;
alter table planner_decision_options add column if not exists bathrooms integer;
alter table planner_decision_options add column if not exists sharing_note text;
alter table planner_decision_options add column if not exists amenities jsonb not null default '[]';
alter table planner_decision_options add column if not exists neighborhood text;
alter table planner_decision_options add column if not exists location_note text;
alter table planner_decision_options add column if not exists lat double precision;
alter table planner_decision_options add column if not exists lng double precision;
alter table planner_decision_options add column if not exists source_url text;
alter table planner_decision_options add column if not exists photo_url text;

-- planner_places real photos — from Google Places (fetched once, client-side,
-- when a place is added via the search box; cached as a URL rather than
-- re-fetched on every render). Null for places that came from LLM
-- extraction (forwarded link/text/screenshot) rather than a Places search.
alter table planner_places add column if not exists google_place_id text;
alter table planner_places add column if not exists photo_url text;

-- ---------------------------------------------------------------------------
-- Phase 9 — accommodation comparison (1c). Supersedes Phase 8's lodging
-- kind: no live data existed under kind='lodging' at migration time, so this
-- reshapes the same columns in place rather than running two versions.
--
-- Per-person-per-night is deliberately NOT a column — it's always derived
-- from total_cost / party_size / nights at read time (see
-- GET /api/v2/trips/[id]/decisions/[decisionId]/comparison), so adding a
-- traveller re-prices every option instead of leaving a stale number
-- sitting in a row nobody remembered to update.
--
-- amenities changes shape from Phase 8's [{label, available}] array to a
-- fixed keyed object ({kitchen, ac, washer, pool, breakfast, wifi}, each
-- boolean | null) — null means nobody's checked, false means confirmed
-- absent; the app must never coerce a missing key to false.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'planner_decisions_kind_check') then
    alter table planner_decisions drop constraint planner_decisions_kind_check;
  end if;
end $$;
update planner_decisions set kind = 'stay' where kind = 'lodging';
alter table planner_decisions add constraint planner_decisions_kind_check check (kind in ('general', 'stay'));
alter table planner_decisions add column if not exists nights integer;
alter table planner_decisions add column if not exists party_size integer;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'planner_decision_options' and column_name = 'option_type'
  ) then
    alter table planner_decision_options rename column option_type to source;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_name = 'planner_decision_options' and column_name = 'total_price'
  ) then
    alter table planner_decision_options rename column total_price to total_cost;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_name = 'planner_decision_options' and column_name = 'sharing_note'
  ) then
    alter table planner_decision_options rename column sharing_note to beds_note;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_name = 'planner_decision_options' and column_name = 'source_url'
  ) then
    alter table planner_decision_options rename column source_url to url;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_name = 'planner_decision_options' and column_name = 'photo_url'
  ) then
    alter table planner_decision_options rename column photo_url to image_url;
  end if;
end $$;

alter table planner_decision_options drop column if exists price_per_person_night;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'planner_decision_options_source_check') then
    alter table planner_decision_options drop constraint planner_decision_options_source_check;
  end if;
end $$;
alter table planner_decision_options add constraint planner_decision_options_source_check
  check (source is null or source in ('airbnb', 'hotel', 'aparthotel', 'other'));

alter table planner_decision_options add column if not exists currency text;
alter table planner_decision_options add column if not exists rating numeric;
alter table planner_decision_options add column if not exists rating_count integer;

alter table planner_decision_options alter column amenities set default '{}'::jsonb;
update planner_decision_options set amenities = '{}'::jsonb where jsonb_typeof(amenities) is distinct from 'object';

-- ---------------------------------------------------------------------------
-- Phase 10 — workspace top bar (3a nav + 3b stuck primary). deadline drives
-- stuck-primary rule 1 (an open decision due within 72h); see
-- src/lib/planner/attention.ts for the full priority waterfall.
-- ---------------------------------------------------------------------------
alter table planner_decisions add column if not exists deadline timestamptz;

-- ---------------------------------------------------------------------------
-- Phase 11 — public profile (1b, the taste feed) + 2a fallback state.
--
-- Follow (planner_follows, Phase 8) is untouched — it was already correctly
-- one-directional. What Phase 8 got wrong for this spec is conflating it
-- with friendship: auto-friending on trip join inserted follow rows in
-- both directions and called that "friends." Friendship is now its own
-- table so following an influencer never implies a friendship, and a
-- shared trip always does. Stored with user_a < user_b so each pair has
-- exactly one row regardless of insert order.
--
-- planner_place_ratings backs both the profile's taste feed AND the 2b
-- rating-capture flow (not built in this pass — that's its own ticket).
-- Building the table now, with the profile querying it, means the profile
-- code is correct on day one even though nothing writes to this table
-- until 2b ships; every profile shows the 2a fallback until then, which is
-- the honest state (nobody has rated anything yet).
-- ---------------------------------------------------------------------------
alter table planner_users add column if not exists is_public boolean not null default true;

create table if not exists planner_friendships (
  user_a uuid not null references planner_users (id) on delete cascade,
  user_b uuid not null references planner_users (id) on delete cascade,
  source text not null default 'trip' check (source in ('trip', 'manual')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists planner_friendships_b_idx on planner_friendships (user_b);

create table if not exists planner_place_ratings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  place_id uuid not null references planner_places (id) on delete cascade,
  user_id uuid not null references planner_users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  unique (trip_id, user_id, place_id)
);
create index if not exists planner_place_ratings_user_idx on planner_place_ratings (user_id);

-- "Ask to join" on someone's public upcoming trip. Creating a request is
-- built; the owner-side accept/decline list is a small addition to the
-- trip page's existing roster section (see PlannerTripPage) rather than a
-- whole new screen.
create table if not exists planner_join_requests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  user_id uuid not null references planner_users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Phase 12 — rating capture (2b). Two timestamps, not a counter: the first
-- prompt fires once end_date is 3+ days past and rating_prompt_sent_at is
-- still null; the one reminder fires once rating_prompt_sent_at is 7+ days
-- old and rating_reminder_sent_at is still null. Once both are set, the
-- daily cron (src/app/api/v2/cron/rating-prompts/route.ts) has nothing
-- left to do for that trip, ever — that's the whole "then never again"
-- rule, with no extra state needed to enforce it.
-- ---------------------------------------------------------------------------
alter table planner_trips add column if not exists rating_prompt_sent_at timestamptz;
alter table planner_trips add column if not exists rating_reminder_sent_at timestamptz;

-- ---------------------------------------------------------------------------
-- Row Level Security — same posture as schema.sql: app code talks to these
-- tables through the service-role admin client, so RLS here exists to deny
-- direct anon/authenticated access via the Supabase REST API, not to
-- implement the real authorization (that's in the Next.js route handlers).
-- ---------------------------------------------------------------------------
alter table planner_users enable row level security;
alter table planner_trips enable row level security;
alter table planner_memberships enable row level security;
alter table planner_invites enable row level security;
alter table planner_preferences enable row level security;
alter table planner_days enable row level security;
alter table planner_itinerary_items enable row level security;
alter table planner_places enable row level security;
alter table planner_resources enable row level security;
alter table planner_decisions enable row level security;
alter table planner_decision_options enable row level security;
alter table planner_decision_votes enable row level security;
alter table planner_decision_notes enable row level security;
alter table planner_whatsapp_codes enable row level security;
alter table planner_availability_marks enable row level security;
alter table planner_item_ratings enable row level security;
alter table planner_trip_reviews enable row level security;
alter table planner_follows enable row level security;
alter table planner_friendships enable row level security;
alter table planner_place_ratings enable row level security;
alter table planner_join_requests enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant all on planner_users, planner_trips, planner_memberships, planner_invites, planner_preferences,
  planner_days, planner_itinerary_items, planner_places, planner_resources,
  planner_decisions, planner_decision_options, planner_decision_votes, planner_decision_notes,
  planner_whatsapp_codes, planner_availability_marks, planner_item_ratings, planner_trip_reviews,
  planner_follows, planner_friendships, planner_place_ratings, planner_join_requests
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Settings page: profile photo, notification channels/cadence, and a
-- default for whether trips this person creates start out public.
-- ---------------------------------------------------------------------------
alter table planner_users add column if not exists avatar_url text;
alter table planner_users add column if not exists notify_sms boolean not null default true;
alter table planner_users add column if not exists notify_email boolean not null default true;
alter table planner_users add column if not exists notify_inapp boolean not null default true;
alter table planner_users add column if not exists digest_frequency text not null default 'daily';
alter table planner_users drop constraint if exists planner_users_digest_frequency_check;
alter table planner_users add constraint planner_users_digest_frequency_check
  check (digest_frequency in ('instant', 'daily', 'weekly', 'urgent'));
alter table planner_users add column if not exists default_trip_public boolean not null default false;
alter table planner_users add column if not exists location text;

-- One public bucket, one folder per Supabase Auth user (avatar upload is
-- only available to email/OAuth-signed-in members — phone-only members
-- have no auth.uid() to scope a folder to).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar public read" on storage.objects;
create policy "avatar public read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatar owner write" on storage.objects;
create policy "avatar owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar owner update" on storage.objects;
create policy "avatar owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar owner delete" on storage.objects;
create policy "avatar owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- planner_trip_saves — bookmarking a friend's public trip from Explore.
-- Lighter than Copy trip: keeps a reference for later instead of
-- duplicating the itinerary into one of your own.
-- ---------------------------------------------------------------------------
create table if not exists planner_trip_saves (
  user_id uuid not null references planner_users (id) on delete cascade,
  trip_id uuid not null references planner_trips (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);
create index if not exists planner_trip_saves_user_idx on planner_trip_saves (user_id);

alter table planner_trip_saves enable row level security;
grant all on planner_trip_saves to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- planner_saved_places — a place "pulled out" of someone else's trip into
-- your own personal pool, independent of any trip until you assign it to
-- one. Snapshotted (name/kind/lat/lng/...) rather than a live reference,
-- since the source place can move or be removed without breaking what you
-- saved. Add to itinerary writes a real planner_places row elsewhere and
-- deletes the pool row here — that's what makes it "leave this list".
-- ---------------------------------------------------------------------------
create table if not exists planner_saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references planner_users (id) on delete cascade,
  source_place_id uuid references planner_places (id) on delete set null,
  source_trip_id uuid references planner_trips (id) on delete set null,
  source_user_id uuid references planner_users (id) on delete set null,
  name text not null,
  kind text not null,
  lat double precision,
  lng double precision,
  address text,
  google_place_id text,
  photo_url text,
  created_at timestamptz not null default now()
);
create unique index if not exists planner_saved_places_user_source_idx
  on planner_saved_places (user_id, source_place_id) where source_place_id is not null;
create index if not exists planner_saved_places_user_idx on planner_saved_places (user_id);

alter table planner_saved_places enable row level security;
grant all on planner_saved_places to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- planner_profile_views — powers the owner-only "N people looked at your
-- profile" nudge copy. One row per visit from a signed-in, non-owner
-- viewer; the nudge counts distinct viewers in a rolling window rather
-- than raw rows, and stays generic (never a fabricated "0 people") when
-- there's no real demand to cite.
-- ---------------------------------------------------------------------------
create table if not exists planner_profile_views (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references planner_users (id) on delete cascade,
  viewer_id uuid not null references planner_users (id) on delete cascade,
  viewed_at timestamptz not null default now()
);
create index if not exists planner_profile_views_owner_idx on planner_profile_views (profile_user_id, viewed_at);

alter table planner_profile_views enable row level security;
grant all on planner_profile_views to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- planner_email_links — bridges "add an email to a phone-only account" to
-- the magic-link confirmation Supabase actually sends. A phone-only
-- account's auth.users row carries a synthetic, unreachable placeholder
-- email (see lib/planner/phoneSession.ts) — Supabase's normal secure email
-- change tries to confirm both the old AND new address, and that
-- placeholder fails Supabase's own validation, so the self-service
-- updateUser() call always errors even though the new-email confirmation
-- still gets sent. This table lets /api/v2/auth/callback recognize "this
-- magic-link click was really an email-add for an already-signed-in phone
-- account" and fold the resulting (throwaway) auth identity into the real
-- one, instead of routing through updateUser()'s dual confirmation at all.
-- ---------------------------------------------------------------------------
create table if not exists planner_email_links (
  email text primary key,
  requesting_planner_user_id uuid not null references planner_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table planner_email_links enable row level security;
grant all on planner_email_links to anon, authenticated, service_role;

-- planner_trips.availability_reminder_sent_at/preferences_reminder_sent_at
-- — set once by the daily cron (src/app/api/v2/cron/stalled-reminders)
-- the first time a stage is down to exactly one holdout, so that trip
-- only ever gets the automatic text once per stage instead of once a day.
alter table planner_trips add column if not exists availability_reminder_sent_at timestamptz;
alter table planner_trips add column if not exists preferences_reminder_sent_at timestamptz;

-- planner_trips.join_code — a short, textable code (e.g. "LISBON4K") a
-- friend can send in to join without ever opening the app or a link,
-- alongside the existing token-based invite link. Every trip gets one at
-- creation, generated in code (src/lib/planner/tokens.ts).
alter table planner_trips add column if not exists join_code text unique;

-- Claims a Twilio MessageSid before doing any work in the two inbound SMS
-- webhooks (src/app/api/v2/twilio/route.ts and .../twilio/conversation/route.ts).
-- The place-extraction pipeline (Anthropic + Google geocoding, per candidate)
-- can run past Twilio's response timeout, which makes Twilio retry the exact
-- same message — without this, both the original request and the retry would
-- independently pass the "not a duplicate yet" check and each insert a place,
-- producing a real, silent duplicate even when nothing is wrong with the
-- dedup logic itself. The insert's primary key does the exclusion atomically;
-- a second insert of the same sid fails and that request bails out quietly.
create table if not exists planner_processed_messages (
  message_sid text primary key,
  created_at timestamptz not null default now()
);

alter table planner_processed_messages enable row level security;
grant all on planner_processed_messages to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- planner_sms_trip_context — which trip a phone's next ambiguous 1:1 text
-- routes to, when they're on more than one active trip and haven't just
-- named one. Set whenever a trip is resolved by an explicit mention or a
-- "switch to X"; read before every routing decision; treated as expired
-- after ACTIVE_TRIP_WINDOW_HOURS (config/limits.ts) of inactivity, checked
-- in code rather than as a database TTL.
-- ---------------------------------------------------------------------------
create table if not exists planner_sms_trip_context (
  phone text primary key,
  trip_id uuid not null references planner_trips (id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table planner_sms_trip_context enable row level security;
grant all on planner_sms_trip_context to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- planner_sms_pending_messages — a 1:1 text held, unanswered, because which
-- of the phone's several active trips it's about couldn't be told apart.
-- Applied to whichever trip the next reply names, so the person never has
-- to resend it; overwritten (not queued) if another ambiguous text arrives
-- first, since only the most recent one is worth asking about.
-- ---------------------------------------------------------------------------
create table if not exists planner_sms_pending_messages (
  phone text primary key,
  candidate_trip_ids uuid[] not null,
  body text not null default '',
  -- [{url, contentType}, ...] for a held MMS — see downloadTwilioMedia.
  media jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table planner_sms_pending_messages enable row level security;
grant all on planner_sms_pending_messages to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- planner_trip_invites — one row per (trip, phone) the organizer has
-- actually invited, replacing the trip-wide join_code as the thing that's
-- actually sent. Lets a "that.fr/j/<token>" link be scoped to a specific
-- invitee (funnel data: clicked_at/joined_at) instead of an undifferentiated
-- code anyone with it can use. join_code (above) keeps working as the
-- manual-fallback path — screenshots/forwards of the link still happen.
-- unique(trip_id, phone) makes "resend/regenerate" an upsert: a new token
-- resets the funnel columns rather than creating a duplicate row.
-- ---------------------------------------------------------------------------
create table if not exists planner_trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  phone text not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  clicked_at timestamptz,
  joined_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  unique (trip_id, phone)
);
create index if not exists planner_trip_invites_trip_idx on planner_trip_invites (trip_id);

alter table planner_trip_invites enable row level security;
grant all on planner_trip_invites to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- planner_users.sms_opted_in_at — the first time this phone ever gave
-- affirmative consent (an inbound text, a tapped join link, or a carried-
-- over opt-in via contact matching), set once and never cleared. Distinct
-- from notify_sms, which is the CURRENT live gate every proactive send
-- checks — it flips false on STOP and can flip true again later without
-- resetting this timestamp. New accounts now default to notify_sms = false
-- (opt-in model) instead of true; existing users keep whatever they already
-- had, since they're already legitimately opted in.
-- ---------------------------------------------------------------------------
alter table planner_users add column if not exists sms_opted_in_at timestamptz;
alter table planner_users alter column notify_sms set default false;

-- ---------------------------------------------------------------------------
-- planner_sms_consent_log — append-only history of consent EVENTS (state
-- changes), not a transcript of every inbound text: see
-- src/lib/planner/consent.ts's recordConsentEvent, which only writes here
-- when notify_sms actually flips from false to true. Exists because
-- notify_sms/sms_opted_in_at on planner_users only ever show current state
-- — if consent is ever challenged, this is the history.
-- ---------------------------------------------------------------------------
create table if not exists planner_sms_consent_log (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  opted_in_at timestamptz not null default now(),
  method text not null check (
    method in ('join_code', 'link_tap', 'contact_match_carryover', 're_opt_in_after_stop', 'inbound_reply')
  ),
  trip_id uuid references planner_trips (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists planner_sms_consent_log_phone_idx on planner_sms_consent_log (phone);

alter table planner_sms_consent_log enable row level security;
grant all on planner_sms_consent_log to anon, authenticated, service_role;

-- One-time backfill: every existing opted-in phone gets a best-guess
-- consent-log entry, since none existed before this table did. join_code is
-- the only join mechanism that existed historically, and created_at is the
-- best available proxy for when consent actually happened. Idempotent via
-- the not-exists check, safe to leave in place / re-run.
insert into planner_sms_consent_log (phone, opted_in_at, method, trip_id)
select u.phone, u.created_at, 'join_code', null
from planner_users u
where u.phone is not null
  and u.notify_sms = true
  and not exists (
    select 1 from planner_sms_consent_log l where l.phone = u.phone
  );

-- ---------------------------------------------------------------------------
-- planner_trips.trip_type — required, picked once at trip creation (the
-- create form disables submit until one is chosen). Replaces the old
-- optional "occasion" chips on that form; `occasion` itself is untouched
-- and still readable on old rows. Nullable at the DB level anyway, since
-- trips created before this shipped have no value and none is backfilled.
-- Trip *templates* per type (pre-seeded decisions/checklists) were
-- designed and explicitly cut — this is a plain classification column,
-- used only for Explore's "Trip type" browse tab.
-- ---------------------------------------------------------------------------
alter table planner_trips add column if not exists trip_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planner_trips_trip_type_check'
  ) then
    alter table planner_trips add constraint planner_trips_trip_type_check
      check (trip_type is null or trip_type in (
        'Bachelorette', 'Girls trip', 'Reunion', 'Ski trip', 'Birthday',
        'Family', 'Remote work week', 'Just a trip'
      ));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- planner_trips.dates_flag_reason — a quick-pick category alongside the
-- existing freeform dates_flag_note, per the design's "What doesn't work?"
-- chips. Still one flag per trip at a time (same as dates_flagged_by/_at/
-- _note above) — the design's own data model is singular too (a single
-- flagReason/flagged boolean), not a real multi-person flag list, so this
-- doesn't need a new table.
-- ---------------------------------------------------------------------------
alter table planner_trips add column if not exists dates_flag_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planner_trips_dates_flag_reason_check'
  ) then
    alter table planner_trips add constraint planner_trips_dates_flag_reason_check
      check (dates_flag_reason is null or dates_flag_reason in (
        'Work conflict', 'Flights too expensive', 'Too short', 'Family thing'
      ));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- planner_backfilled_countries — the public profile map's "Add somewhere
-- you've been" picker. Travel from before someone joined That Friend: a
-- country plus the cities they can recall and roughly when, with no trip
-- and no ratings behind it. Rendered on the map in a fainter shade than
-- countries with real ratings, and superseded by real ratings if the
-- country later gets some (see countryFromAddress-based grouping in
-- src/lib/planner/travelMap.ts, which takes precedence in the UI).
-- country_code is the ISO 3166-1 numeric code, unpadded, matching the
-- world-atlas topojson feature ids the map already keys off of.
-- ---------------------------------------------------------------------------
create table if not exists planner_backfilled_countries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references planner_users (id) on delete cascade,
  country_code text not null,
  country_name text not null,
  cities text[] not null default '{}',
  travelled_when text,
  created_at timestamptz not null default now(),
  unique (user_id, country_code)
);
create index if not exists planner_backfilled_countries_user_idx on planner_backfilled_countries (user_id);

alter table planner_backfilled_countries enable row level security;
grant all on planner_backfilled_countries to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- planner_guide_interactions — powers each guide's "Jonah opened this" /
-- "Nobody in your circle has opened this yet" line on Explore. guide_id is
-- a static id from src/lib/planner/guides.ts, not a foreign key — guides
-- live in code, not the database. One row per (guide, user, kind); the
-- unique constraint means recording a repeat open or clone is a harmless
-- no-op rather than something callers need to check for first.
-- ---------------------------------------------------------------------------
create table if not exists planner_guide_interactions (
  id uuid primary key default gen_random_uuid(),
  guide_id text not null,
  user_id uuid not null references planner_users (id) on delete cascade,
  kind text not null check (kind in ('open', 'clone')),
  created_at timestamptz not null default now(),
  unique (guide_id, user_id, kind)
);
create index if not exists planner_guide_interactions_guide_idx on planner_guide_interactions (guide_id);

alter table planner_guide_interactions enable row level security;
grant all on planner_guide_interactions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Sept 23 — the live-trip additions from the That Friend.dc.html update.
-- ---------------------------------------------------------------------------

-- planner_trip_essentials — the pinned "Essentials" card on a trip: address,
-- door code, Wi-Fi, host, emergency contact. One row per field so the group
-- can add whatever their place actually needs. `stay` groups fields under a
-- tab ("Lisbon" / "Lagos") on a multi-stay trip; null means the trip has
-- one place and no tabs are shown.
create table if not exists planner_trip_essentials (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  stay text,
  label text not null check (char_length(label) between 1 and 60),
  value text not null check (char_length(value) between 1 and 200),
  sub text check (sub is null or char_length(sub) <= 200),
  position integer not null default 0,
  created_by uuid references planner_users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists planner_trip_essentials_trip_idx on planner_trip_essentials (trip_id);

alter table planner_trip_essentials enable row level security;
grant all on planner_trip_essentials to anon, authenticated, service_role;

-- Plan B on a day: what the group does instead ("If it rains" → museum
-- then the garden café). plan_b_active flips the day onto it; flipping
-- texts the group once, which is what "everyone notified" on the day
-- card refers to.
alter table planner_days add column if not exists plan_b_when text;
alter table planner_days add column if not exists plan_b_text text;
alter table planner_days add column if not exists plan_b_active boolean not null default false;

-- A place's group-size note: "Fit 15 of us, long tables", "Tables of 6
-- max, no bookings". Whether a place works for this many people is the
-- question a group actually has, and nothing else on the card answers it.
alter table planner_places add column if not exists group_note text;

-- planner_trip_lessons — "What would you do differently?", asked once on
-- a past trip's Reviews page. Shown back as "Last time" on the next trip
-- the same people plan together (see src/lib/planner/lessons.ts).
create table if not exists planner_trip_lessons (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  user_id uuid not null references planner_users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default now()
);
create index if not exists planner_trip_lessons_trip_idx on planner_trip_lessons (trip_id);

alter table planner_trip_lessons enable row level security;
grant all on planner_trip_lessons to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Arrivals, departures and ride groups — the cards that open and close the
-- itinerary rail. One leg per person per direction: "TP 1234 from Gatwick"
-- landing 14:20. Everyone adds their own; the card derives who's missing
-- and who lands close together, and ride groups are tagged on top.
-- ---------------------------------------------------------------------------
create table if not exists planner_travel_legs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  user_id uuid not null references planner_users (id) on delete cascade,
  direction text not null check (direction in ('arrive', 'depart')),
  detail text not null check (char_length(detail) between 1 and 120),
  date date not null,
  time time not null,
  created_at timestamptz not null default now(),
  unique (trip_id, user_id, direction)
);
create index if not exists planner_travel_legs_trip_idx on planner_travel_legs (trip_id);

alter table planner_travel_legs enable row level security;
grant all on planner_travel_legs to anon, authenticated, service_role;

-- "Ride 1 · Maya, Jonah, Nina · 15:15" — who shares the taxi from (or to)
-- the airport. Numbered per direction in creation order at render time.
create table if not exists planner_ride_groups (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  direction text not null check (direction in ('arrive', 'depart')),
  member_ids uuid[] not null,
  time time,
  created_by uuid references planner_users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists planner_ride_groups_trip_idx on planner_ride_groups (trip_id);

alter table planner_ride_groups enable row level security;
grant all on planner_ride_groups to anon, authenticated, service_role;
