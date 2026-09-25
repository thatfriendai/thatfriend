-- P2-2: tied votes, 2026-09-29. Safe to run more than once. Run in the
-- Supabase SQL editor (planner_schema.sql carries the same check for fresh
-- setups).
--
-- planner_decisions.status gains a third value: a decision that was closed
-- with two or more options tied for the top vote count now lands on
-- `tied` (decided_option_id left null) instead of silently picking
-- whichever option was listed first. Only the trip owner can move a `tied`
-- decision to `closed` (POST .../decisions/[decisionId]/decide), or anyone
-- can reopen it to keep voting. See src/app/api/v2/trips/[id]/decisions/[decisionId]/close/route.ts.
alter table planner_decisions drop constraint if exists planner_decisions_status_check;
alter table planner_decisions add constraint planner_decisions_status_check
  check (status in ('open', 'closed', 'tied'));
