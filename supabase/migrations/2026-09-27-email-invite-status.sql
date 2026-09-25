-- P1-A: real email invite delivery status, 2026-09-27. Safe to run more
-- than once. Run in the Supabase SQL editor (planner_schema.sql carries
-- the same columns for fresh setups).
--
-- Was: /api/v2/trips/[id]/invites stored the row and returned
-- delivered: true unconditionally — nothing sent an email, and nothing
-- recorded whether one had. See src/lib/planner/email.ts.
alter table planner_invites add column if not exists status text not null default 'pending'
  check (status in ('pending', 'sent', 'delivered', 'failed', 'bounced'));
alter table planner_invites add column if not exists sent_at timestamptz;
alter table planner_invites add column if not exists error text;
