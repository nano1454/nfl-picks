-- Playoffs pool has its own roster, independent of the regular-season
-- `participants` table (which has no season/competition scoping at all) --
-- some people opt out of playoffs, some new people opt in. Same shape and
-- same lockdown pattern as `participants` (RLS enabled, zero public
-- policies, service-role only via Admin-gated Netlify functions).
create table if not exists playoffs_participants (
  user_name text primary key,
  buy_in numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table playoffs_participants enable row level security;
