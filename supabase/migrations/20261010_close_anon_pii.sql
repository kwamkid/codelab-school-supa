-- 20261010_close_anon_pii.sql
-- Close anon/public access to family PII and finance tables.
--
-- ⚠️  APPLY ONLY AFTER the LIFF code that stops reading/writing parents/students
--     from the browser is DEPLOYED to production. Before that deploy, these LIFF
--     pages still query parents/students with the anon key and would break:
--       - components/liff/liff-provider.tsx        (last-login update)
--       - app/liff/register/page.tsx               ("already registered" check)
--       - app/liff/(portal)/profile/[id]/...       (edit parent / edit student)
--       - app/liff/events/register/[id]/page.tsx   (own-family autofill, phone lookup)
--     They now go through /api/liff/* (service role + verified LINE identity):
--     /api/liff/profile, /api/liff/student-detail, /api/liff/student (DELETE),
--     /api/liff/last-login, /api/liff/phone-lookup.
--
-- What this does:
--   1. parents / students: drop the 6 anon policies (anyone with the public anon
--      key could read every family's name/phone/address and rewrite
--      phone/line_user_id). Staff (authenticated) policies are untouched.
--   2. credit_notes / tax_invoices: the "Service role full access" policies were
--      granted TO public (= everyone incl. anon). The staff browser client reads
--      these tables directly (lib/services/credit-notes.ts, tax-invoices.ts,
--      receipts.ts via getClient()); all writes go through adminMutation
--      (service role, bypasses RLS). → replace with SELECT for authenticated only.
--   3. fb_conversion_logs: "Allow all access" TO public. Only server code touches
--      it (lib/fb/handler.ts, app/api/fb/* — all createServiceClient) → drop it;
--      service_role bypasses RLS, everyone else is denied.
--   4. get_liff_* RPCs are SECURITY DEFINER and return a family's profile /
--      schedule / feedback by LINE user id. They're only called server-side with
--      the service role (lib/supabase/services/liff-*.ts) → revoke EXECUTE from
--      anon/authenticated/public.

begin;

-- 1. parents / students — anon policies
drop policy if exists parents_select_anon  on public.parents;
drop policy if exists parents_insert_anon  on public.parents;
drop policy if exists parents_update_anon  on public.parents;
drop policy if exists students_select_anon on public.students;
drop policy if exists students_insert_anon on public.students;
drop policy if exists students_update_anon on public.students;

-- 2. credit_notes / tax_invoices — staff read only (writes = service role)
drop policy if exists "Service role full access on credit_notes" on public.credit_notes;
drop policy if exists "Service role full access on tax_invoices" on public.tax_invoices;

drop policy if exists credit_notes_select_authenticated on public.credit_notes;
create policy credit_notes_select_authenticated
  on public.credit_notes for select to authenticated using ((select public.is_staff()));

drop policy if exists tax_invoices_select_authenticated on public.tax_invoices;
create policy tax_invoices_select_authenticated
  on public.tax_invoices for select to authenticated using ((select public.is_staff()));

-- 3. fb_conversion_logs — service role only (no policy needed; RLS stays on)
drop policy if exists "Allow all access" on public.fb_conversion_logs;

-- 4. LIFF RPCs — server (service role) only
revoke execute on function public.get_liff_home(text)               from public, anon, authenticated;
revoke execute on function public.get_liff_profile(text)            from public, anon, authenticated;
revoke execute on function public.get_liff_feedback(text)           from public, anon, authenticated;
revoke execute on function public.get_liff_makeup(text)             from public, anon, authenticated;
revoke execute on function public.get_liff_schedule(text, date, date) from public, anon, authenticated;
grant  execute on function public.get_liff_home(text)               to service_role;
grant  execute on function public.get_liff_profile(text)            to service_role;
grant  execute on function public.get_liff_feedback(text)           to service_role;
grant  execute on function public.get_liff_makeup(text)             to service_role;
grant  execute on function public.get_liff_schedule(text, date, date) to service_role;

commit;
