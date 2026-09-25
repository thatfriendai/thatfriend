-- P1-C: multi-trip SMS routing, 2026-09-26. Safe to run more than once. Run
-- in the Supabase SQL editor (planner_schema.sql carries the same tables
-- for fresh setups).
--
-- planner_sms_trip_context — which trip a phone's next ambiguous 1:1 text
-- routes to, when they're on more than one active trip. See
-- src/lib/planner/smsTripRouting.ts.
create table if not exists planner_sms_trip_context (
  phone text primary key,
  trip_id uuid not null references planner_trips (id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table planner_sms_trip_context enable row level security;
grant all on planner_sms_trip_context to anon, authenticated, service_role;

-- planner_sms_pending_messages — a text held because which of the phone's
-- several active trips it's about couldn't be told apart, applied once the
-- next reply names one.
create table if not exists planner_sms_pending_messages (
  phone text primary key,
  candidate_trip_ids uuid[] not null,
  body text not null default '',
  media jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table planner_sms_pending_messages enable row level security;
grant all on planner_sms_pending_messages to anon, authenticated, service_role;
