-- DESTRUCTIVE: discards any spread_picks rows for the live current week
-- permanently. Do not run until bonus_picks is confirmed working
-- end-to-end (App.jsx no longer reads/writes spread_picks or spread_line,
-- getweek.cjs/importSchedule.cjs no longer reference spread_line).
drop table if exists spread_picks;
alter table games drop column if exists spread_line;
