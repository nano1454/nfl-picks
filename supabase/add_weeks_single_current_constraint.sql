-- Defense in depth for the 2026-09-10 incident: setCurrentWeek.cjs cleared
-- is_current scoped to the wrong season during a season rollover, leaving
-- two rows with is_current=true (a stale season=2025 week=10 row and the
-- real season=2026 week=1 row). The scheduled scoring job's `.maybeSingle()`
-- lookup silently picked the stale one, scoring the wrong week for hours.
-- The application code is now fixed too, but this constraint makes the
-- underlying data corruption impossible regardless of any future code bug.
create unique index if not exists weeks_single_current_idx
  on weeks (is_current)
  where is_current = true;
