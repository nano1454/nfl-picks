-- Stores the point spread for each game, frozen at the moment the week is
-- first imported (see importSchedule.cjs) so every participant picks against
-- the same number regardless of when during the week they submit, and
-- regardless of how the real market line moves afterward.

alter table games add column if not exists spread_line numeric;
