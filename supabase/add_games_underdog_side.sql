-- Playoffs pool: which side (AWAY/HOME) is the betting underdog for this
-- game, set automatically from real moneylines by syncPlayoffOdds.js and
-- kept in sync until the game locks. Only ever populated for playoff
-- weeks (19-22) -- the regular-season import path never writes to it, so
-- it's always null for every week-1-18 game, exactly as before this column
-- existed.
alter table games add column if not exists underdog_side text
  check (underdog_side is null or underdog_side in ('AWAY', 'HOME'));
