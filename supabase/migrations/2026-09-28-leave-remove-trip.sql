-- P1-B: leave/remove a trip, 2026-09-28. Safe to run more than once. Run
-- in the Supabase SQL editor (planner_schema.sql carries the same tables
-- for fresh setups).
--
-- planner_memberships gains a soft-delete status — never a hard delete,
-- since votes/cost history need to persist. See
-- src/lib/planner/membership.ts.
alter table planner_memberships add column if not exists status text not null default 'active'
  check (status in ('active', 'left', 'removed'));
alter table planner_memberships add column if not exists left_at timestamptz;
alter table planner_memberships add column if not exists removed_by uuid references planner_users (id) on delete set null;

-- The low-key "X left the trip" / "X was removed" in-app notice.
create table if not exists planner_trip_activity (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists planner_trip_activity_trip_idx on planner_trip_activity (trip_id);
alter table planner_trip_activity enable row level security;
grant all on planner_trip_activity to anon, authenticated, service_role;
