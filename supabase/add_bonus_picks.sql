-- Stores each participant's pick for the two bonus yardage categories
-- (passing_yards, rushing_yards), replacing spread_picks. One generalized
-- table with a `category` discriminator, mirroring the existing
-- `tiebreakers` table's `tb_no` discriminator (one table, several "flavors"
-- of the same row) rather than one dedicated table per category.

create table if not exists bonus_picks (
  id uuid primary key default gen_random_uuid(),
  week integer not null,
  game_id text not null,
  category text not null check (category in ('passing_yards', 'rushing_yards')),
  pick text not null check (pick in ('AWAY', 'HOME')),
  user_name text not null,
  created_at timestamptz not null default now(),
  constraint uniq_bonus_picks_week_game_user_category unique (week, game_id, user_name, category)
);

alter table bonus_picks enable row level security;

create policy "public can read bonus_picks" on bonus_picks for select to public using (true);
create policy "public can insert bonus_picks" on bonus_picks for insert to public with check (true);
-- Included from day one: spread_picks shipped without this and every
-- resubmission silently 42501'd until add_update_policies.sql patched it in
-- later. Not repeating that mistake here.
create policy "public can update bonus_picks" on bonus_picks for update using (true) with check (true);
