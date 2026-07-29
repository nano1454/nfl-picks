-- Follow-up to enable_rls_legacy_tables.sql: Admin.jsx no longer reads or
-- writes participants/week_payments directly with the public anon key --
-- it now goes through PIN-checked Netlify functions (getAdminParticipants,
-- upsertParticipant, setParticipantActive, setWeekPayment,
-- importParticipantNames) using the service-role key, which always
-- bypasses RLS. So the public policies added earlier are no longer needed
-- and are dropped here, leaving both tables fully locked down --
-- matching weeks/week_games (RLS enabled, zero policies, service-role only).

drop policy if exists "public read participants" on participants;
drop policy if exists "public write participants" on participants;
drop policy if exists "public update participants" on participants;

drop policy if exists "public read week_payments" on week_payments;
drop policy if exists "public write week_payments" on week_payments;
drop policy if exists "public update week_payments" on week_payments;
