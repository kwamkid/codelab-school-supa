-- Supabase advisor rls_disabled_in_public: backup table from the 2026-08-24 teacher
-- merge was readable/writable by anon (holds teacher bank account + phone + email).
-- Not used by app code → lock to service role only; data kept.
alter table public.backup_teacher_merge_20260824 enable row level security;
revoke all on public.backup_teacher_merge_20260824 from anon, authenticated;
