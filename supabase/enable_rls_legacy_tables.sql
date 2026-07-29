-- Fixes the Supabase security advisory: "RLS Disabled in Public" on
-- participants, week_meta, week_payments, weeks, week_games.
--
-- week_games and weeks are never queried from the browser (only from
-- Netlify functions using the service-role key, which always bypasses
-- RLS), so they get RLS enabled with zero policies -> fully locked down.
--
-- week_meta is read directly from the browser (Results, Leaderboard,
-- Admin) with the public anon key but only ever written via service-role
-- functions -> public SELECT only.
--
-- participants and week_payments are both read AND written directly
-- from the browser (Admin.jsx) with the anon key -> need public SELECT
-- + INSERT/UPDATE to keep the admin dashboard working exactly as it does
-- today. Note: Admin.jsx's "protection" is a PIN typed into the UI, not
-- enforced by the database, so this does not newly lock those two tables
-- down against someone who has the anon key -- it just matches the
-- app's existing (already-public) behavior instead of leaving them wide
-- open to DELETE as well.

alter table week_games enable row level security;

alter table weeks enable row level security;

alter table week_meta enable row level security;
create policy "public read week_meta" on week_meta for select to public using (true);

alter table week_payments enable row level security;
create policy "public read week_payments" on week_payments for select to public using (true);
create policy "public write week_payments" on week_payments for insert to public with check (true);
create policy "public update week_payments" on week_payments for update to public using (true) with check (true);

alter table participants enable row level security;
create policy "public read participants" on participants for select to public using (true);
create policy "public write participants" on participants for insert to public with check (true);
create policy "public update participants" on participants for update to public using (true) with check (true);
