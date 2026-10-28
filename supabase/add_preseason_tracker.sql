-- "Season Fund" -- off-season preseason payment tracker. Participants make
-- small deposits toward next season's full buy-in at their own pace instead
-- of being chased week-by-week once the season starts. Ships fully built
-- but dormant: `enabled` defaults to false and stays false until the admin
-- flips it on from Admin.jsx (setPreseasonTrackerEnabled.cjs), at which
-- point the frontend starts showing it (NavDrawer link + the real page
-- instead of a "coming soon" placeholder).

-- Append-only deposit ledger. Same public trust-based RLS convention as
-- picks/tiebreakers/bonus_picks (see add_update_policies.sql): a
-- participant can insert their own row directly from the browser, no
-- Netlify function needed. The one addition beyond that precedent is the
-- `with check (status = 'pending')` -- it's structurally impossible for a
-- participant to insert a row that's already approved; only the
-- admin-gated reviewPreseasonDeposit.cjs (service role) can do that. No
-- public UPDATE/DELETE policy at all, so a participant can't edit or
-- un-submit their own pending row either -- corrections past that point are
-- an admin-only action (editPreseasonDeposit.cjs).
create table if not exists preseason_deposits (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  user_name text not null,
  amount numeric not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

alter table preseason_deposits enable row level security;

create policy "public can select preseason_deposits" on preseason_deposits
  for select using (true);

create policy "public can insert pending preseason_deposits" on preseason_deposits
  for insert with check (status = 'pending');

-- Single row per season -- the admin on/off switch plus the dollar target.
-- Public SELECT only (same reasoning as games/leaderboard being directly
-- readable); no public write, ever.
create table if not exists preseason_tracker_settings (
  season int primary key,
  enabled boolean not null default false,
  target_amount numeric not null default 540
);

alter table preseason_tracker_settings enable row level security;

create policy "public can select preseason_tracker_settings" on preseason_tracker_settings
  for select using (true);

-- Seed next season's row so the page/nav have something to read from day
-- one. `enabled` defaults to false -- dormant until the admin turns it on.
insert into preseason_tracker_settings (season, enabled, target_amount)
values (2027, false, 540)
on conflict (season) do nothing;
