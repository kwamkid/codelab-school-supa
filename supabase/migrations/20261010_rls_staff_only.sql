-- RLS: "authenticated" ≠ staff.
-- Google sign-in is open (Supabase creates an auth user for ANY Google account —
-- 15 non-staff auth users existed on 2026-10-10). The app's membership guard only
-- signs them out client-side, but their JWT still carried role=authenticated, and
-- 136 policies on 40 tables granted `authenticated` USING/WITH CHECK (true) —
-- i.e. any Google account could read/write parents, students, enrollments,
-- settings (LINE/FB tokens) … straight through PostgREST.
--
-- Fix: every such policy now requires public.is_staff() = the caller is an ACTIVE
-- row in admin_users (matched by auth_user_id). Staff behaviour is unchanged.
-- Also fixes public.is_admin(), which compared admin_users.id (≠ auth id) to
-- auth.uid() and therefore was always false.
--
-- Safe to apply independently of app deploys: the admin app only runs as staff;
-- LIFF/public flows use anon or server routes (service role bypasses RLS);
-- membership/invite checks go through /api/auth/lookup + /api/invitations/* (service role).

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_users
    where auth_user_id = auth.uid() and is_active = true
  )
$$;

revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  -- was `where id = auth.uid()` — admin_users.id is NOT the auth id (always false)
  return exists (
    select 1 from admin_users
    where auth_user_id = auth.uid()
      and is_active = true
  );
end;
$function$;

-- Rewrite every authenticated-only policy whose condition is literally `true`.
-- `(select public.is_staff())` is evaluated once per statement (initPlan), not per row.
do $$
declare
  p record;
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and roles::text = '{authenticated}'
      and coalesce(qual, 'true') = 'true'
      and coalesce(with_check, 'true') = 'true'
  loop
    if p.cmd = 'INSERT' then
      sql := format('alter policy %I on %I.%I with check ((select public.is_staff()))', p.policyname, p.schemaname, p.tablename);
    elsif p.cmd in ('SELECT', 'DELETE') then
      sql := format('alter policy %I on %I.%I using ((select public.is_staff()))', p.policyname, p.schemaname, p.tablename);
    else -- UPDATE / ALL
      sql := format('alter policy %I on %I.%I using ((select public.is_staff())) with check ((select public.is_staff()))', p.policyname, p.schemaname, p.tablename);
    end if;
    execute sql;
  end loop;
end $$;
