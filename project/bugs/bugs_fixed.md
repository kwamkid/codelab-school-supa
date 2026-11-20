# Bugs fixed

> Fixed bugs, newest on top: symptom → root cause → fix → links.

<!-- toc -->
**Contents** (1)
- 2026-11-20 — Supabase alert "Table publicly accessible" (rls_disabled_in_public)
<!-- /toc -->

---

## 2026-11-20 — Supabase alert "Table publicly accessible" (rls_disabled_in_public)
- Symptom: Supabase security email (issues as of 14 Nov 2026) flagged a public table without RLS.
- Root cause: ad-hoc backup table `public.backup_teacher_merge_20260824` (3 teacher rows incl. bank account, phone, email), created during the 24 Aug teacher merge without RLS → anon key could read/edit/delete it. No app code uses it.
- Fix: enable RLS + revoke all from anon/authenticated (data kept, service role only). Applied to prod via psql; verified no table in `public`/`vex` lacks RLS. Migration [20261120_rls_backup_teacher_merge.sql](../../supabase/migrations/20261120_rls_backup_teacher_merge.sql), commit a08a7d6.
- Supabase MCP `get_advisors` failed (no access token), so the advisor was not re-checked; it clears on the next scan.
