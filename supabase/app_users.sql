-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
-- Creates the table backing username/full-name/PIN login.
-- All access happens through the Netlify "auth" function using the service-role key,
-- so RLS stays enabled with no public policies (no direct client access).

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  full_name text not null,
  pin_hash text not null,
  pin_salt text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists app_users_username_ci_idx on app_users (lower(username));

alter table app_users enable row level security;
