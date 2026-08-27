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
  created_at timestamptz not null default now()
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
  kind text not null check (kind in ('Restaurants', 'Bars', 'Museums', 'Activities', 'Other')),
  note text,
  map_x numeric not null,
  map_y numeric not null,
  added_by uuid references planner_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists planner_places_trip_idx on planner_places (trip_id);

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

grant usage on schema public to anon, authenticated, service_role;
grant all on planner_users, planner_trips, planner_memberships, planner_invites, planner_preferences,
  planner_days, planner_itinerary_items, planner_places
  to anon, authenticated, service_role;
