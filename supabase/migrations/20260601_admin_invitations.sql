-- Invite-link system for admin/teacher onboarding via Google OAuth.
-- A super admin creates an invitation (role + branches + permissions, pre-filled
-- teacher data when role=teacher). The invitee opens /invite/<token>, signs in with
-- Google, and the accept flow creates their admin_users (and teachers) record.

create table if not exists public.admin_invitations (
  id uuid primary key default extensions.uuid_generate_v4(),
  token text unique not null,
  email text,                                   -- optional hint; NOT locked (anyone with link can use)
  display_name text,
  role admin_role not null default 'branch_admin',
  branch_ids uuid[] default '{}',
  can_manage_users boolean default false,
  can_manage_settings boolean default false,
  can_view_reports boolean default false,
  can_manage_all_branches boolean default false,
  teacher_data jsonb,                           -- {nickname, phone, specialties} for role=teacher
  created_by uuid references public.admin_users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_email text,
  used_by_auth_id uuid,
  revoked_at timestamptz,
  revoked_by uuid references public.admin_users(id)
);

create index if not exists admin_invitations_token_idx on public.admin_invitations (token);
create index if not exists admin_invitations_created_at_idx on public.admin_invitations (created_at desc);

comment on table public.admin_invitations is 'Invite links for admin/teacher onboarding via Google OAuth. Accessed only via service role (server API routes).';

-- RLS enabled with no policies → only the service role (server-side API routes) can read/write.
alter table public.admin_invitations enable row level security;
