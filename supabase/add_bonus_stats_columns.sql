-- Per-team passing/rushing yardage for each FINAL game, plus the
-- precomputed winner per bonus category ('AWAY' | 'HOME' | 'PUSH'),
-- mirroring the existing `winner` column's precomputed convention. All
-- nullable: nflverse's stats_team_week_{season}.csv is derived from
-- play-by-play and typically isn't published until a few hours after a
-- game goes FINAL in the score feed this app already polls every 2 min.
alter table game_results add column if not exists away_passing_yards numeric;
alter table game_results add column if not exists home_passing_yards numeric;
alter table game_results add column if not exists away_rushing_yards numeric;
alter table game_results add column if not exists home_rushing_yards numeric;
alter table game_results add column if not exists passing_winner text; -- 'AWAY' | 'HOME' | 'PUSH'
alter table game_results add column if not exists rushing_winner text; -- 'AWAY' | 'HOME' | 'PUSH'
