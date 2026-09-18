-- Lets the wizard precisely tell whether a game's underdog_side changed
-- AFTER a specific user's pick was saved (compare against picks.created_at
-- for that pick), rather than just "changed recently" -- only ever set by
-- syncPlayoffOdds.js when the derived underdog actually flips, not on every
-- sync run.
alter table games add column if not exists underdog_side_updated_at timestamptz;
