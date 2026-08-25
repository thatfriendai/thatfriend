-- That Friend — Phase 0/1/2 schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_dates text,
  status text not null default 'planning',
  created_by uuid not null references auth.users (id) on delete cascade,
  -- Whether everyone's preferences show real names or "Anonymous" — a
  -- trip-wide setting anyone in the group can flip, not a per-submission
  -- choice, so it's never half-public-half-private.
  preferences_visibility text not null default 'public' check (preferences_visibility in ('public', 'private')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- participants
-- ---------------------------------------------------------------------------
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  name text not null,
  email text,
  role text not null default 'guest' check (role in ('organizer', 'guest')),
  -- E.164 phone number (e.g. "+15551234567"), set once someone links
  -- WhatsApp. A phone can only be linked to one participant at a time —
  -- linking it elsewhere moves it, it doesn't duplicate — so an inbound
  -- WhatsApp message maps to exactly one (trip, participant).
  phone_number text,
  created_at timestamptz not null default now()
);

create index if not exists participants_trip_id_idx on participants (trip_id);
create unique index if not exists participants_phone_number_idx
  on participants (phone_number) where phone_number is not null;

-- ---------------------------------------------------------------------------
-- whatsapp_connect_codes — short-lived codes used once to link a phone
-- number to a participant ("text CONNECT-XY7Q to +1... to link WhatsApp").
-- Consumed (deleted) as soon as the code is used.
-- ---------------------------------------------------------------------------
create table if not exists whatsapp_connect_codes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- preferences
-- ---------------------------------------------------------------------------
create table if not exists preferences (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  category text not null check (category in ('Dates', 'Budget', 'Location', 'Activity', 'Veto')),
  value text not null,
  type text not null check (type in ('Preference', 'Constraint', 'Veto')),
  source_text text,
  created_at timestamptz not null default now()
);

create index if not exists preferences_trip_id_idx on preferences (trip_id);

-- ---------------------------------------------------------------------------
-- places
-- ---------------------------------------------------------------------------
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  category text,
  added_by uuid references participants (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists places_trip_id_idx on places (trip_id);

-- ---------------------------------------------------------------------------
-- place_notes — freeform notes/links attached to a saved place ("my friend
-- loved this", a pasted article link), for gathering itinerary research in
-- one spot rather than a group chat.
-- ---------------------------------------------------------------------------
create table if not exists place_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  place_id uuid not null references places (id) on delete cascade,
  participant_id uuid references participants (id) on delete set null,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists place_notes_place_id_idx on place_notes (place_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Guests reach trip data only by knowing a trip's unguessable UUID (the
-- shareable link) and never talk to Supabase directly with the anon key —
-- all guest reads/writes go through Next.js server actions using the
-- service role key, which bypasses RLS entirely. RLS below only needs to
-- cover the organizer-authenticated paths (their own "my trips" dashboard),
-- and otherwise defaults to deny so the public anon key can't be used to
-- dump data directly against the Supabase REST API.
-- ---------------------------------------------------------------------------
alter table trips enable row level security;
alter table participants enable row level security;
alter table preferences enable row level security;
alter table places enable row level security;
alter table place_notes enable row level security;
alter table whatsapp_connect_codes enable row level security;

create policy "Organizers can view their own trips"
  on trips for select
  to authenticated
  using (created_by = auth.uid());

create policy "Organizers can create trips"
  on trips for insert
  to authenticated
  with check (created_by = auth.uid());

-- RLS policies only take effect once a role already has table-level
-- privileges — without these grants every query 403s with "permission
-- denied for table X" regardless of policy.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
