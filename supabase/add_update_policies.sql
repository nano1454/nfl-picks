-- Picks, spread picks, and tiebreakers only had public INSERT/SELECT RLS
-- policies. upsert() correctly finds the conflicting row via the existing
-- unique index and tries to UPDATE it, but with no UPDATE policy that
-- update is rejected (42501), so a participant could never save a change
-- to an already-saved pick. Match the same public trust level the existing
-- INSERT policies already use.
create policy "public can update picks" on picks
  for update using (true) with check (true);

create policy "public can update spread_picks" on spread_picks
  for update using (true) with check (true);

create policy "public can update tiebreakers" on tiebreakers
  for update using (true) with check (true);
