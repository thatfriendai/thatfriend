-- QA hardening, 2026-09-23. Safe to run more than once. Run in the
-- Supabase SQL editor (planner_schema.sql carries the same change for
-- fresh setups).
--
-- planner_whatsapp_codes.attempts — wrong guesses against a sign-in code.
-- /api/v2/auth/verify-phone throws a code away after 5. Until this runs,
-- verify-phone falls back to burning a code on its first wrong guess.
alter table planner_whatsapp_codes add column if not exists attempts int not null default 0;
