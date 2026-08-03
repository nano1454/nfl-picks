-- Stores each participant's "who covers the spread" pick per game, alongside
-- the existing picks/tiebreakers tables. Structured the same way as `picks`
-- but with a clean unique constraint matching what the app's upsert actually
-- targets (week, game_id, user_name) -- the existing `picks` table has a
-- constraint on a normalized column instead, which doesn't match its
-- upsert's onConflict target, so resubmitting a changed pick 409s there.
-- Kept simple here on purpose so that doesn't happen for spread picks.

create table if not exists spread_picks (
  id uuid primary key default gen_random_uuid(),
  week integer not null,
  game_id text not null,
  pick text not null check (pick in ('AWAY', 'HOME')),
  user_name text not null,
  created_at timestamptz not null default now(),
  constraint uniq_spread_picks_week_game_user unique (week, game_id, user_name)
);

alter table spread_picks enable row level security;

create policy "public can read spread_picks" on spread_picks for select to public using (true);
create policy "public can insert spread_picks" on spread_picks for insert to public with check (true);
