# 📚 Learning & gotchas

> Bugs/traps we hit + the fix, and new techniques worth remembering.
> Newest at the bottom. Append-only via `/memo`.

---

## 2026-06-12 — Google avatar (lh3.googleusercontent.com) 403 → no-referrer

**Symptom:** Teacher/user avatars from Google OAuth didn't load (fell back to initials) even though the URL was correct and present in `auth.users`.
**Root cause:** `lh3.googleusercontent.com` returns 403 when the browser sends a referrer header.
**Fix:** `components/ui/avatar.tsx` `AvatarImage` now defaults `referrerPolicy="no-referrer"` (callers can still override). Helps every avatar system-wide.

## 2026-06-12 — `teachers.available_branches` is `uuid[]`, not `text[]`

**Symptom:** Class list showed teacher "Unknown" whenever a branch was selected; "ทั้งหมด" worked.
**Root cause:** RPC `get_class_lookup_data` compared `available_branches @> ARRAY[p_branch_id::text]` → Postgres has no `uuid[] @> text[]` operator → the whole RPC threw → client fell back → teachers empty. With `p_branch_id IS NULL` the `@>` short-circuited, so "all branches" hid the bug.
**Fix:** compare against the uuid directly. Then realized the branch filter itself was wrong for name-resolution (a พระราม 2 teacher can cover a เมืองทอง class) → the teachers list in that RPC now returns ALL teachers (no branch/is_active filter); it's a name-resolution map, not the picker dropdown (that uses `getTeachersByBranch` separately).

## 2026-06-12 — `admin_users.id` ≠ `auth.users.id` (link by email)

**Symptom:** Joining `admin_users` to `auth.users` on `id` returned nothing (last-login, Google avatar).
**Root cause:** They are NOT the same uuid; the only reliable link is **email** (`lower(u.email) = lower(au.email)`).
**Fix:** RPC `get_admin_users_with_last_login` (SECURITY DEFINER) joins by email to surface `last_sign_in_at` + Google avatar. Also: "เข้าใช้งานล่าสุด" on `/users` was showing `updated_at` (not a real last login) — now uses `auth.users.last_sign_in_at`. Teacher nickname is in `teachers.nickname` (empty on `admin_users` for teacher logins) → the RPC also surfaces `teacher_nickname` as a fallback.

## 2026-06-12 — React Query `staleTime: Infinity` hides DB/RPC changes

**Symptom:** Teacher avatars correct in the DB/RPC but the classes page still showed the old (null) data until a hard reload.
**Fix:** lowered the `classLookupData` query `staleTime` from `Infinity` to 5 min so teacher avatar/name changes propagate without a hard refresh.

## 2026-06-14 — Parent LINE avatar missing even when linked

**Symptom:** Some parents with `line_user_id` set showed no photo (initials fallback) on `/parents`.
**Root cause (two layers):** (1) `createParent`'s INSERT only wrote 4 fields — it dropped `picture_url` + `line_display_name`, so LIFF sign-ups never got a saved avatar. (2) Parents who registered via LIFF but never chatted have NO `chat_contacts` row, so there was nothing to mirror from.
**Fix:** `createParent` insert now includes `picture_url` + `line_display_name`, and the LIFF register page passes `profile.pictureUrl` / `profile.displayName` from `useLiff()`. Backfilled existing blanks two ways: mirror from `chat_contacts.avatar_url` (join on `platform_user_id = line_user_id`, NOT the unpopulated `chat_contacts.parent_id` FK), then `/api/admin/parents/backfill-line-pictures` (GET-able one-off) which fetches `GET /v2/bot/profile/{userId}` with `settings.line.messagingChannelAccessToken`. Parents truly without a LINE photo stay on initials.

## 2026-06-14 — `useSearchParams` needs a `<Suspense>` boundary

**Symptom:** Adding `useSearchParams()` to a page risks a Next.js App-Router build error.
**Fix:** split the page into an inner content component and wrap it in `<Suspense>` (mirrors `app/(admin)/enrollments/new/page.tsx`). Used for the add-student `?returnTo=` flow.

## 2026-06-18 — Dropdown action in a clickable table row goes to wrong page

**Symptom:** In the classes list, clicking "แก้ไข" in the row's `⋯` menu navigated to the **detail** page, not `/edit`.
**Root cause:** The whole `<TableRow>` has `onClick={() => router.push('/classes/${id}')}`. The Radix `DropdownMenuContent` renders in a **portal** (outside the row in the DOM), so a click on a menu item bubbles up and triggers the row's onClick, which wins over the `<Link>`'s navigation.
**Fix:** `stopPropagation` on BOTH the action `<TableCell>` (covers the trigger button) AND the `<DropdownMenuContent>` (covers the portaled items). Cell-only is not enough because the menu lives in the portal.

## 2026-06-18 — Classes list progress bar always 0%

**Symptom:** "ความคืบหน้า" progress bar never filled in the classes list.
**Root cause:** TS (`lib/services/lookup.ts`) reads `data.classStats` (classId → completed_sessions), but RPC `get_class_lookup_data`'s `json_build_object(...)` **never included a `classStats` key** → always `undefined` → every class `done=0`.
**Fix:** RPC now aggregates `class_schedules` where `status='completed'` per class (respecting branch filter) and returns it as `classStats`. Migration `20260618_class_lookup_data_with_stats`. No TS change needed.

## 2026-06-18 — Event→enrollment conversion: no FK, link by phone + 7-day window

**Technique:** There is NO explicit link between `event_registrations` and `enrollments`. The reliable join is **normalized phone**: `event_registrations.parent_phone` → `parents.phone` → `enrollments.parent_id`. "Converted" = that parent has an active/completed enrollment with `enrolled_at` within **7 days after** `registered_at`. Phone must be normalized (`regexp_replace(phone,'\D','','g')`) on both sides — formats vary. RPC `get_event_conversion(p_event_id)` returns rate + converted list. Migration `20260618_event_conversion_metric`. Caveat: guests whose phone doesn't match a real `parents` row are uncountable.

## 2026-06-18 — Edit-permission alert contradicted the actual field locks

**Symptom:** A "กำลังเรียน" class showed "ไม่สามารถแก้ไขวันที่และเวลา" yet the schedule fields were editable (for super admin).
**Root cause:** The warning text came from `canEditClassDates` (status-only, ignores role) while field-disabling came from `getEditableFields` (which had a super-admin override). Two sources of truth → contradiction.
**Fix:** Made edit permissions a single source — see the rules.md entry on enrollment-driven edit. The form's alert now derives purely from `editableFields`.

## 2026-07-12 — `attendance.checked_by` is a `uuid` FK — CANNOT hold `'parent-liff'`

**Symptom:** LIFF parent leave never wrote an attendance row; the try/catch silently swallowed the error. Also a "count parent-liff absences" filter would match 0 rows forever.
**Root cause:** `attendance.checked_by` is `uuid` (admin/teacher id). The old `requestLeave` wrote `checked_by: 'parent-liff'` (a string) → insert/update errored. There is NO reliable way to distinguish "parent-recorded" vs "admin-recorded" via `checked_by`.
**Fix:** `requestLeave` (`lib/supabase/services/liff-data.ts`) now writes `status:'leave'`, `checked_by: null`, note `'ลาผ่านระบบ LIFF'`. The **source of truth for a LIFF leave is the paired `makeup_classes` row** (`requested_by='parent-liff'`), not the attendance row.

## 2026-07-12 — Shift/pause a class hard-deletes `class_schedules` → FK violation if a session has a makeup

**Symptom:** "ลายกคลาส" (attendance checker) / "พักทั้งคลาส" (admin) would fail for exactly the classes most likely to be shifted — ones with absent students.
**Root cause:** `makeup_classes.original_schedule_id → class_schedules` is a FK with `ON DELETE NO ACTION` (RESTRICT). `rebookSessions` (`lib/services/classes.ts`) batch-DELETEs future scheduled rows; if any is referenced by a non-cancelled makeup, the whole delete (and thus the shift/pause) aborts with a 23503. Verified live: 35 makeups pointed at future scheduled sessions across real classes (VEXGO2/VEXIQ2/VEXIQ3 had 4 each). Bug predated the new shift feature — `pauseClass` had it too.
**Fix:** `rebookSessions` now splits the removal set: rows referenced by a live makeup are **UPDATEd to `status='cancelled'`** (row kept → FK intact → makeup still resolves); the rest are DELETEd as before. `reschedule.ts` (holiday) already used a keep-if-referenced pattern — same idea. Do NOT switch the FK to CASCADE (would destroy makeup history).
