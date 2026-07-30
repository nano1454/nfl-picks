-- Adds real per-account admin status, replacing the static VITE_ADMIN_PIN
-- (which was a client-side env var baked into the JS bundle -- readable
-- by anyone who inspected it, not a real secret).

alter table app_users add column if not exists is_admin boolean not null default false;
