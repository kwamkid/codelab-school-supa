# Scripting
> Ad-hoc test scripts against this repo.

<!-- toc -->
<!-- /toc -->

---

- 2026-11-20 — `npx tsx` scripts must live inside the repo (e.g. `scripts/.tmp/`, delete after) or `@supabase/supabase-js` won't resolve; importing `lib/format.ts` from an `.mts` script fails ESM named-export interop — inline the helper instead. Service key env is `SUPABASE_SECRET_KEY`.
- 2026-11-20 — Attendance "checked" must exclude auto rows: `createMakeupRequest` writes absent + 'Makeup requested:%' and LIFF leave writes 'ลาผ่านระบบ LIFF%', both with `checked_by` NULL. Use `public.attendance_is_auto(note, checked_by)` in any new check-rate SQL (842c08c).
