-- LIFF identity audit — one row per LIFF API call resolved by resolveLiffUser().
-- Purpose: measure how often the portal still relies on the UNVERIFIED
-- body.lineUserId fallback before we remove it (devplan 2026-10-10).
--   outcome: verified      = LINE ID token verified
--            no_token      = no Authorization header → fell back to body.lineUserId
--            expired       = token sent but LINE says it expired → fell back
--            invalid       = token sent but rejected for another reason → fell back
--            unauthorized  = neither a valid token nor a body lineUserId → 401
-- Service role only. Safe to drop once the fallback is gone.

create table if not exists public.liff_auth_audit (
  id bigserial primary key,
  route text not null,
  outcome text not null check (outcome in ('verified', 'no_token', 'expired', 'invalid', 'unauthorized')),
  line_user_id text,
  detail text,
  in_line_app boolean,
  created_at timestamptz not null default now()
);
create index if not exists idx_liff_auth_audit_created on public.liff_auth_audit (created_at desc);
alter table public.liff_auth_audit enable row level security;
-- no policies: service role only
