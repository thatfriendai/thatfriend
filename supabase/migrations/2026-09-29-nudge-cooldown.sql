-- P2-7: nudge cooldown, 2026-09-29. Safe to run more than once. Run in
-- the Supabase SQL editor (planner_schema.sql carries the same table for
-- fresh setups).
--
-- One row per nudge actually sent (not per person nudged). sendNudge
-- checks the most recent row for a (trip_id, stage) before sending, so
-- every caller — the web button, the daily cron, and both "nudge" SMS
-- intents — shares one cooldown per trip+stage. See
-- src/lib/planner/nudge.ts and src/config/limits.ts's NUDGE_COOLDOWN_HOURS.
create table if not exists planner_nudge_log (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references planner_trips (id) on delete cascade,
  stage text not null check (stage in ('availability', 'preferences')),
  mode text not null check (mode in ('individual', 'group')),
  sent_by uuid references planner_users (id) on delete set null,
  target_count integer not null default 0,
  sent_at timestamptz not null default now()
);
create index if not exists planner_nudge_log_trip_stage_idx on planner_nudge_log (trip_id, stage, sent_at desc);

alter table planner_nudge_log enable row level security;
grant all on planner_nudge_log to anon, authenticated, service_role;
