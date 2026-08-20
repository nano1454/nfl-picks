-- Gates new signups behind admin approval. default true grandfathers every
-- existing account (Adrian's own admin login + current real participants)
-- in with this single statement -- auth.cjs's signup path explicitly passes
-- approved: false going forward so only NEW signups start out pending.
alter table app_users add column if not exists approved boolean not null default true;
