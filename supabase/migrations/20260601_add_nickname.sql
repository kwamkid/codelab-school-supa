-- Add nickname to admin_users (and invitations) so every user — not just teachers —
-- can have a short display nickname. Login identity is the Google email; nickname/name
-- are display-only.
alter table public.admin_users add column if not exists nickname text;
alter table public.admin_invitations add column if not exists nickname text;
