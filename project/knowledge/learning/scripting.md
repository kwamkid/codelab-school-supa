# Scripting
> Ad-hoc test scripts against this repo.

<!-- toc -->
<!-- /toc -->

---

- 2026-11-20 — `npx tsx` scripts must live inside the repo (e.g. `scripts/.tmp/`, delete after) or `@supabase/supabase-js` won't resolve; importing `lib/format.ts` from an `.mts` script fails ESM named-export interop — inline the helper instead. Service key env is `SUPABASE_SECRET_KEY`.
