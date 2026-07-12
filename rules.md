# 📐 Rules & conventions

> Hard rules Claude must follow in this project. Append-only via `/memo`.

---

## Shared person/role badges (2026-06-12)
- Display a **teacher** name anywhere (lists, dialogs, reports, LIFF) → use `<TeacherBadge name imageUrl size>` (`components/ui/teacher-badge.tsx`, warm tones + avatar).
- Display a **parent** name → use `<ParentBadge>` (`components/ui/parent-badge.tsx`, cool/blue tones + avatar).
- Display a **student** name → use `<StudentBadge>` (`components/ui/student-badge.tsx`, green chip, no avatar).
- Restyle the role chips in ONE place each — `PersonBadge` (in teacher-badge.tsx) is the shared renderer for teacher+parent.
- Do NOT put avatars in teacher/parent **picker dropdowns** (`<Select>` to choose a person) — badges are for read-only display only.

## Sortable table columns (2026-06-12)
- Click-to-sort columns use the shared `SortableTableHead` + `useSortableTable()` hook (`components/ui/sortable-table-head.tsx`). Don't hand-roll per-page sort UI.
- Click cycle per column: asc → desc → cleared. Sort runs before pagination. nulls go last.

## Class list "คลาส" column (2026-06-12)
- In the classes list, the "คลาส" cell shows **subject name** as the title and **`cls.code`** (real code, e.g. `MZ101-CLRM2-2606-3WU`) as the subtitle. NOT `cls.name` — that is the human schedule code and often has stray spaces from how users named it.

## Class filters (2026-06-12)
- The class-list filter row uses the shared `FormSelect` (`components/ui/form-select.tsx`) for subject/teacher/availability — it auto-switches to a searchable select past `searchThreshold` (default 7). Don't use a plain `<Select>` for long lists.

## Stat cards = full-colour (2026-06-14)
- Top-of-page summary/stat cards use solid gradient backgrounds with white text (NOT a left-border accent on a white card). See `/users` + `/parents` for the pattern (`bg-gradient-to-br from-X-500 to-X-600`, icon + label `text-white/90`, big number). The user dislikes the left-border style.

## LINE connection icon (2026-06-14)
- Show LINE linked/unlinked status with the shared `<LineIcon connected={...} />` (`components/ui/line-icon.tsx`, real LINE brand logo) — green `#06C755` when linked, grey when not. NOT a `MessageCircle` (generic chat bubble) and NOT a text badge. Lucide has no brand logos.

## Add-student navigation (2026-06-14)
- "เพิ่มนักเรียน" links pass `?returnTo=<path>`; the new-student page + `StudentForm` use it for back/cancel/after-save so you return to where you came from (list vs detail), falling back to the parent detail page.

## LINE avatar on registration (2026-06-14)
- When creating a parent from a LINE/LIFF flow, always pass `pictureUrl` + `lineDisplayName` from the LIFF `profile` into `createParent` (its insert now persists them). Don't rely on `chat_contacts` mirroring — LIFF-only sign-ups have no chat contact.

## Class list "คลาส" column — show class NAME now (2026-06-18, supersedes 2026-06-12)
- The classes-list "คลาส" cell now shows **`cls.name`** (the class name, e.g. "Vex V5 Competition 2026-2027") as the title and **`cls.code`** as the subtitle. This REVERSES the earlier rule that said show subject name — user explicitly wants the class name. (`cls.name` and `cls.code` are genuinely different columns; verified in DB.)

## Number & currency inputs (2026-06-18)
- Any quantity/amount field uses `<NumberInput value onValueChange ... suffix>` (`components/ui/number-input.tsx`) — thousands separators while editing, stores a real `number`, supports `min`/`max`/`decimals`/`suffix`/`prefix`/`readOnly`.
- Money fields use `<CurrencyInput>` (`components/ui/currency-input.tsx`) — wraps NumberInput, **฿ as a postfix symbol**, default 0 decimals. Don't hand-roll `<Input type="number">` for prices/counts. (So far wired into the class form; roll out to other forms over time.)

## Class edit permissions = enrollment-driven, NOT role/status (2026-06-18)
- `getEditableFields(classData)` is driven purely by `enrolledCount`: **no students → edit anything** (incl. push the start date out, regen schedules); **has students → lock schedule/pricing/resources**, only name/description/max-capacity/status stay editable. A super admin must NOT be able to rewrite the schedule of a class students already enrolled in. The `canEditAll` param is kept for call-site compat but ignored. The form's lock-warning derives from `editableFields`, not from class status.

## Card header spacing (2026-06-18)
- The shared `Card` (`components/ui/card.tsx`) uses `gap-4` between header and content (was `gap-1`, too tight). This is global — don't add per-card top-margin hacks to CardContent.

## Makeup leave quota — what counts (2026-07-12)
- The leave quota per course = `settings.makeupLimitPerCourse` (default 4, `0` = unlimited). **Read it from settings — never hardcode `4`.** LIFF reads it via `getMakeupQuota()` in `lib/supabase/services/liff-data.ts`; admin/attendance via `getMakeupSettings()`.
- A makeup counts toward the quota only when `makeup_classes.counts_toward_quota = true` (boolean, `NOT NULL DEFAULT true`). Set it **false** for non-leaves: **sickness (ป่วย)**, enrollment catch-up (สมัครช้า), class/enrollment pause (พักคลาส), teacher-caused. Real leave/absence (ลา/ขาด) stays true.
- Every quota counter MUST filter `.eq('counts_toward_quota', true).neq('status','cancelled')` — `getMakeupCount` (`lib/services/makeup.ts`) and LIFF `requestLeave`/`getMakeupData` already do. When adding a new makeup-creation path, pass `countsTowardQuota` explicitly.
- **Admin/teacher bypass the limit**: `saveAttendanceWithMakeup` still creates the makeup when over-limit (only records the name in `limitExceeded` for a UI heads-up). Never `continue`/skip creation on limit.

## "ลายกคลาส" from the attendance checker (2026-07-12)
- The attendance checker's "ลายกคลาส (ยกคลาส)" button calls `shiftClassFromSession()` (`lib/services/classes.ts`) — cancels today's session and shifts the remaining sessions ~1 week (reuses `pauseClass`'s rebook logic). **No makeup is created** (whole class bumped, not a per-student leave). Both teacher + admin can trigger it. Room/teacher conflicts on the shifted dates are only *reported* (count in a toast) for an admin to resolve later — a conflict-resolver UI is NOT built yet (phase 2).
