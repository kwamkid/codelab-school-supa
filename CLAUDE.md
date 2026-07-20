# CodeLab School Supa - Project Guide

## Tech Stack
- **Framework:** Next.js (App Router)
- **Database:** Supabase (PostgreSQL + PostgREST)
- **Auth:** Supabase Auth (email/password)
- **UI:** shadcn/ui + Radix UI + Tailwind CSS + Lucide React icons
- **Forms:** React Hook Form + Zod
- **State:** React Query, Context API (Branch, Loading, Makeup)
- **Charts:** Recharts
- **Calendar:** FullCalendar (used in class detail), Dashboard uses custom Time×Room grid
- **Toast:** Sonner
- **Export:** html2canvas
- **LINE:** @line/liff, @line/bot-sdk

## Architecture

### Data Access Pattern
```
Client Component → fetch() → API Route (/api/admin/mutation) → Supabase Service Role → DB (RLS bypassed)
```
- `adminMutation` pattern: client calls `/api/admin/mutation` with service role to bypass RLS
- ALLOWED_TABLES whitelist in `app/api/admin/mutation/route.ts`
- Use `as any` casts for tables not in generated Database types

### Critical: Supabase Client Limitation
Supabase JS client `.eq()` does NOT work on tables not in generated Database types (e.g. `invoices`, `credit_notes`).
Use direct PostgREST fetch for server-side API routes. See `app/api/admin/invoices/route.ts` for the pattern.

## Shared Components

### UI Components (`components/ui/`)
| Component | File | Description |
|-----------|------|-------------|
| Button | `components/ui/button.tsx` | Primary orange (#F4511E), variants: default/destructive/outline/secondary/ghost/link |
| Dialog | `components/ui/dialog.tsx` | Modal dialogs |
| AlertDialog | `components/ui/alert-dialog.tsx` | Confirmation dialogs |
| Card | `components/ui/card.tsx` | Card container |
| Table | `components/ui/table.tsx` | Data table |
| Pagination | `components/ui/pagination.tsx` | Table pagination |
| Badge | `components/ui/badge.tsx` | Status/tag badges |
| Input | `components/ui/input.tsx` | Text input |
| Textarea | `components/ui/textarea.tsx` | Multi-line input |
| Select | `components/ui/select.tsx` | Radix select dropdown |
| FormSelect | `components/ui/form-select.tsx` | Select with form support |
| Checkbox | `components/ui/checkbox.tsx` | Checkbox |
| Switch | `components/ui/switch.tsx` | Toggle switch |
| RadioGroup | `components/ui/radio-group.tsx` | Radio buttons |
| Tabs | `components/ui/tabs.tsx` | Tab navigation |
| Label | `components/ui/label.tsx` | Form labels |
| Form | `components/ui/form.tsx` | React Hook Form integration |
| Calendar | `components/ui/calendar.tsx` | Calendar widget |
| DateRangePicker | `components/ui/date-range-picker.tsx` | Date range picker |
| TimeRangePicker | `components/ui/time-range-picker.tsx` | Time range picker |
| Command | `components/ui/command.tsx` | Command palette/autocomplete |
| AutocompleteInput | `components/ui/autocomplete-input.tsx` | Text autocomplete |
| SearchInput | `components/ui/search-input.tsx` | Search bar with icon |
| DropdownMenu | `components/ui/dropdown-menu.tsx` | Dropdown menus |
| Popover | `components/ui/popover.tsx` | Floating panels |
| Avatar | `components/ui/avatar.tsx` | User avatars |
| Progress | `components/ui/progress.tsx` | Progress bars |
| Alert | `components/ui/alert.tsx` | Alert messages |
| EmptyState | `components/ui/empty-state.tsx` | Empty state placeholder |
| Loading | `components/ui/loading.tsx` | Loading spinner |
| Sonner | `components/ui/sonner.tsx` | Toast notifications |
| PageHeader | `components/ui/page-header.tsx` | Page title section |
| BranchSelector | `components/ui/branch-selector.tsx` | Branch selection dropdown |
| BranchBadge | `components/ui/branch-badge.tsx` | Branch display badge |
| RoleBadge | `components/ui/role-badge.tsx` | Role/permission badge |
| StatusBadge | `components/ui/status-badge.tsx` | Status indicator |
| ActionButton | `components/ui/action-button.tsx` | Multi-action button |
| StudentSearchSelect | `components/ui/student-search-select.tsx` | Student search dropdown |
| SubjectSearchSelect | `components/ui/subject-search-select.tsx` | Subject search dropdown |
| GradeLevelCombobox | `components/ui/grade-level-combobox.tsx` | Grade level selector |
| ProvinceCombobox | `components/ui/province-combobox.tsx` | Province selector |
| SchoolNameCombobox | `components/ui/school-name-combobox.tsx` | School name autocomplete |

### Shared Business Components (`components/shared/`)
| Component | File | Description |
|-----------|------|-------------|
| ParentSearchInput | `components/shared/parent-search-input.tsx` | Parent phone/name search |
| SubjectSelector | `components/shared/subject-selector.tsx` | Subject selection with age validation |
| TrialBookingForm | `components/shared/trial-booking-form.tsx` | Trial session booking form |
| CompactEnrollmentForm | `components/shared/compact-enrollment-form.tsx` | Lightweight enrollment form |

### Custom Hooks (`hooks/`)
| Hook | File | Description |
|------|------|-------------|
| useAuth | `hooks/useSupabaseAuth.tsx` | Auth state, login, logout, permissions, role checks |
| useBranchFilter | `hooks/useBranchFilter.ts` | Filter data by selected branch |
| useSettings | `hooks/useSettings.ts` | Load app settings with real-time updates |
| useChatRealtime | `hooks/useChatRealtime.ts` | Chat message/conversation subscriptions |
| useDocumentPrint | `hooks/useDocumentPrint.ts` | Print/export document utilities |
| useTokenRefresh | `hooks/useTokenRefresh.ts` | JWT token lifecycle |
| useLiffParent | `hooks/useLiffParent.ts` | LINE LIFF parent profile |

### Context Providers (`contexts/`)
| Context | File | Description |
|---------|------|-------------|
| BranchContext | `contexts/BranchContext.tsx` | `useBranch()` → selectedBranchId, setSelectedBranchId |
| LoadingContext | `contexts/LoadingContext.tsx` | Global loading state |
| MakeupContext | `contexts/MakeupContext.tsx` | Makeup class workflow state |

### Key Services (`lib/services/`)
| Service | File | Key Methods |
|---------|------|-------------|
| enrollments | `lib/services/enrollments.ts` | getEnrollments, createEnrollment, updateEnrollment |
| trial-bookings | `lib/services/trial-bookings.ts` | getTrialBookings, updateTrialSession(sessionId, data) |
| classes | `lib/services/classes.ts` | getClasses, getClassSchedules, fixEnrolledCount |
| parents | `lib/services/parents.ts` | searchParentsUnified, createParent, checkParentPhoneExists |
| students | `lib/services/students.ts` | getStudents, createStudent |
| teachers | `lib/services/teachers.ts` | getTeachers, createTeacher |
| subjects | `lib/services/subjects.ts` | getSubjects, createSubject |
| branches | `lib/services/branches.ts` | getBranches, getBranch |
| rooms | `lib/services/rooms.ts` | getRoomsByBranch, getRoomAvailability |
| makeup | `lib/services/makeup.ts` | createMakeupRequest, getMakeupClassesByStudent |
| payment-transactions | `lib/services/payment-transactions.ts` | createPaymentTransaction, getPaymentTransactions |
| receipts | `lib/services/receipts.ts` | createReceipt, getReceipt, voidReceipt |
| admin-users | `lib/services/admin-users.ts` | getAdminUser, createAdminUser |
| chat | `lib/services/chat.ts` | getConversations, getMessages, sendMessage, sendBatchMessage, markConversationRead, getQuickReplies, createQuickReply, updateQuickReply |
| events | `lib/services/events.ts` | getEvents, createEvent, getEventSchedules, createEventSchedule, getEventRegistrations |
| admin-mutation | `lib/admin-mutation.ts` | Generic mutation helper (table, operation, data, match) |

## File Organization
```
app/
├── (admin)/          # Admin pages (dashboard, enrollments, classes, etc.)
├── (public)/         # Public pages (login)
├── api/              # API routes
│   ├── admin/        # Admin APIs (mutation, chat, invoices)
│   ├── auth/         # Auth APIs (lookup)
│   └── webhooks/     # Webhook handlers (LINE, Facebook)
├── liff/             # LINE LIFF pages
components/           # 130+ files, domain-organized
├── ui/               # 40+ shadcn/Radix components
├── shared/           # Reusable business components
├── enrollments/      # Enrollment wizard + payment
├── trial/            # Trial booking management
├── chat/             # Chat/LINE messaging
├── invoices/         # Receipts, tax invoices, credit notes
├── settings/         # Settings sub-pages
├── liff/             # LINE mobile components
└── [domain]/         # Other domain components
hooks/                # Custom React hooks
contexts/             # Context providers
lib/
├── services/         # 45+ domain services
├── supabase/         # Supabase client setup
├── utils.ts          # cn(), formatDate(), formatDateWithDay()
├── admin-mutation.ts # Generic admin mutation helper
├── fb/               # Facebook API
└── line/             # LINE LIFF
types/
├── models.ts         # All domain model types
└── supabase.ts       # Auto-generated DB types
```

## Key Rules
- New pages must use `text-base` (16px), NOT `text-sm`/`text-xs`
- Tables use `text-sm` (14px) — set in shared `components/ui/table.tsx`
- `AdminUser.branchIds` (plural array), NOT `branchId`
- `updateTrialSession(sessionId, data)` takes 2 args
- `BranchContext` provides `selectedBranchId`, NOT `branches` array — load via `getBranches()`
- Settings are sub-pages under `/settings/*`, not tabs
- Use `useRef` guard for preventing double-submit
- `adminMutation` route supports operations: `insert`, `update`, `delete`, `upsert`, `select` (with `order` option)
- Super admin can edit all class fields regardless of status (`getEditableFields(classData, isSuperAdmin)`)
- When super admin changes schedule fields → `regenerateClassSchedules()` auto-regenerates future schedules
- Rooms use soft delete (`is_active = false`), never hard delete
- Class **names are NOT unique** — cron `update-class-status` appends ` (จบแล้ว)` to the name when marking a class completed (idempotent; 204 old classes backfilled 2026-07-20, originals in DB table `backup_class_names_20260719`)
- "ลายกคลาส" (shift) records `classes.last_shift_date` → class detail shows an amber banner + "ยกเลิกการเลื่อน" (`undoShiftClassFromSession`) valid until that date passes or a shifted session gets checked; regenerates from the shift date inclusive so original dates come back exactly
- Teacher avatars resolve via RPCs `get_active_teachers_with_avatar` / `get_teacher_with_avatar` (profile_image → linked admin_user's Google avatar) — a plain `.from('teachers')` read has empty profile_image for everyone; `getTeachers`/`getActiveTeachers`/`getTeacher` all use the RPCs
- Dashboard uses RPC `get_daily_timetable(p_date, p_branch_id)` for single-query data loading
- Do NOT change existing `.toISOString()` patterns in services — they work correctly with the current data flow

## Event System
- Event registration API: `app/api/events/register/route.ts` — inserts into `event_registrations` + `event_registration_students` + `event_registration_parents`
- Per-branch quota: `event_schedules.max_attendees_by_branch` (jsonb) — each branch has its own quota, `max_attendees` is total sum
- Location: if `locationType === 'branch'` → auto-generates location from branch names, LIFF uses branch lat/lng for Google Maps link; if external → uses `event.locationUrl`
- LIFF registration page: phone lookup auto-fills parent/student data via `searchParentsUnified()`
- `fullDescription` shown as expandable section in LIFF registration page
- Event images: uploaded to Supabase Storage bucket `event-images`, upload happens on form save (not on file select)

## Chat System
- Supabase Storage buckets: `event-images` (5MB, images), `chat-media` (25MB, images+video)
- Upload API: `app/api/upload/route.ts` — supports `bucket` param to select storage bucket
- Chat send API: `app/api/admin/chat/send/route.ts` — supports `mediaUrls` array for batch send
- LINE batch: max 5 messages per push request, auto-splits if more → saves LINE credits
- FB/IG: sends messages rapidly for image grouping (album effect)
- Quick Replies: `chat_quick_replies` table with `images` (jsonb array) + `image_url` columns
- Quick Reply Dialog: `components/chat/quick-reply-dialog.tsx` — list/create/edit/preview modes, multi-image dropzone
- `sendBatchMessage()` sends text blocks + images in 1 API request; DB stores each block/image as separate message
- Conversation list sorts by `lastMessageAt` only (NOT unread-first) to prevent jumping when marking read
- Sidebar unread badge polls every 15 seconds via `getTotalUnreadCount()`
- Conversation search is 2-step: in-memory over loaded rows first, then DB on demand. Name/phone via "ค้นหาเพิ่มเติมในฐานข้อมูล" button (`searchConversations`); tag filter auto-queries DB (`getConversationsByTags`, `.overlaps`). Picking a DB-only result fetches+adds it to the list.

## LINE Display Name & Parent ↔ Chat Linking (Jun 2026)
- `parents` table has **NO `updated_at` column** — never write it in parents updates (silently broke `linkParentToLine` before). Migration `20260606_add_parent_line_display_name` added `parents.line_display_name`.
- Parent LINE identity split: `parents.display_name` = entered name; `parents.line_display_name` = real LINE profile name; `parents.picture_url` = avatar. `mapToParent` in `lib/services/parents.ts` maps all three.
- Real LINE name/avatar live in `chat_contacts.display_name`/`avatar_url` (keyed by `platform_user_id` = LINE userId).
- Auto-link `chat_contacts` ↔ `parents` by LINE id (both directions): webhook `findOrCreateContact` on new contact, `linkParentToLine` on LIFF register, `linkContactToParent` syncs name/avatar onto parent.
- `get_daily_timetable` RPC returns `teacher_image` = `COALESCE(teachers.profile_image, Google avatar via admin_users→auth.users)` and `total_sessions`.

## Attendance ("เช็คชื่อ") System
- Detailed checker is a shared component `components/attendance/attendance-checker.tsx` (`<AttendanceChecker classId scheduleId onSaved onCancel showHeader>`) — used by both the full page `app/(admin)/attendance/[classId]/[sessionId]/page.tsx` and the modal.
- `components/attendance/attendance-dialog.tsx` — opened from `/attendance` list (row/จัดการ click), starts at the selected date's session; "เลือกคาบอื่น" switches to a session-picker view inside the same modal. Pass `scheduleId` = `cls.todaySchedule.id` (already on the list row).
- Save logic centralized in `saveAttendanceWithMakeup()` (`lib/services/attendance.ts`): saves attendance + auto creates/cancels makeup per settings (`getMakeupSettings` → `allowMakeupForStatuses` default `['absent','sick','leave']`, `autoCreateMakeup`, `makeupLimitPerCourse`).
- Status meaning: present/late = attended (NO makeup, shows Teacher Feedback shown to parents); absent/leave/sick = makeup auto-created (differ only by recorded reason). UI status order: มา/สาย/ขาด/ลา/ป่วย.
- Dashboard modal also checks attendance inline: regular class → full checker; makeup/trial → quick มาเรียน/ขาด (`recordMakeupAttendance` / `updateTrialSession`).
- **Teacher feedback + photos (Jun 2026):** `AttendanceChecker` shows a feedback textarea + 1 photo (present/late students). Photos are resized client-side (`lib/utils/image.ts` `resizeImageToJpeg`, canvas→JPEG, iPhone-safe), **staged in memory only** and uploaded **on save** (bucket `attendance-photos`, public). Don't upload on add. Stored in `attendance.photos text[]` (migration `20260608_attendance_photos`).
- On save, `saveAttendanceWithMakeup` snapshots old feedback/photos and enqueues a LINE notification **only for students whose feedback/photos changed** (no spam; re-edit re-sends) → see LINE Notification Queue below.
- Admin `/attendance` list status badge colors: green=มาครบ, yellow=มาไม่ครบ, orange=ขาดหมด, red=ยังไม่เช็ค ("came" = present+late). Shows the substitute teacher's name (not just a "แทน" badge) via `actualTeacher` resolved from `cls.todaySchedule.actualTeacherId`.
- Teacher class filter MUST use `adminUser.teacherId` (the linked `teachers.id`), NOT `adminUser.id` — they differ for newer teacher accounts. Using the wrong id shows 0 classes + infinite spinner.

## Teacher Home Page (`/teacher`)
- One-stop page for `role=teacher`: today's classes + makeup + trial, with per-card **check-in button** (opens shared `AttendanceDialog`) and **open-slide button**.
- Data via RPC `get_teacher_daily_schedule(p_teacher_id, p_date, p_branch_id)` (migration `20260608_teacher_daily_schedule_rpc`). Honors `COALESCE(class_schedules.actual_teacher_id, classes.teacher_id)` so **both teacher-change cases** (per-session substitute + permanent `changeClassResources`) show up on the right teacher's page after refresh.
- RPC returns `subject_id`, `total_sessions`, `material_id`. Slide link = match `teaching_materials` by `subject_id` + `session_number` (active only); makeup resolves the session from `original_schedule_id`. Button → `/teaching/slides/{subjectId}/{materialId}`; disabled "ยังไม่มีสไลด์" when no `material_id`.
- Sidebar: `ลาและชดเชย` (`/makeup`) and `คลาสเรียน` (`/classes`) are hidden from `role=teacher` (`requiredRole: ['super_admin','branch_admin']`). Menu-only — pages are not route-guarded.

## LINE Notification Queue (outbox) — central LINE noti
- All new LINE notifications go through an outbox: table `line_notification_queue` (migrations `20260608_line_notification_queue` + `_generalize`). Columns: `type` (feedback|makeup|custom), `schedule_id`/`student_id` (feedback), `ref_id`+`payload` (generic), `status` (pending|sent|failed), `retry_count` (max 5). RLS on, service-role only. Whitelisted in `ALLOWED_TABLES`.
- Enqueue = reliable awaited `adminMutation` insert (so it can't be lost). Processor `lib/supabase/services/line-queue.ts` `processLineQueue()` dispatches by type, sends via LINE push (text + image), marks sent/failed, retries. **feedback rows also `logNotification(...)`** so they appear in the log page.
- Triggers: immediate best-effort `POST /api/admin/notifications/process` (fire-and-forget after save) + hourly safety-net cron `GET /api/cron/process-line-queue?secret=<CRON_SECRET>` (registered on cron-job.org). Sends are NOT real-time-guaranteed but never lost (cron drains pending).
- Makeup "scheduled" notification now enqueues `type:'makeup'` (was broken Firebase). Cron reminders (class/makeup-reminder/event) still send directly server-side — fine, already working.
- Settings toggle `enableFeedbackNotifications` (LINE settings → การแจ้งเตือนอัตโนมัติ, sub-toggle under `enableNotifications`); processor skips feedback when off.
- **Notification logs view = Reports menu → "Notification Logs" (`/reports/notification-logs`)**, NOT under Settings.
- LIFF parent "Teacher Feedback" page `/liff/feedback` reads via server route `POST /api/liff/feedback` (service role, avoids LIFF RLS issues), shows feedback text + photos. `lib/services/feedback.ts` was rewritten Firebase→Supabase.

## Multi-recipient LINE Noti (พ่อ+แม่) + Secondary LIFF Accounts (Jul 2026)
- ตาราง `parent_line_recipients`: ผู้รับ LINE เพิ่มเติมของครอบครัว (invite token → ตอบรับ). `parents.line_user_id` ยังเป็นผู้รับหลัก. RLS service-role only, whitelisted ใน ALLOWED_TABLES.
- **กติกา: sender LINE ตัวใหม่ทุกตัวต้อง fan-out ผ่าน `getParentLineIds(parentId, primaryLineId)`** (`lib/supabase/services/line-notifications.ts`) — ห้ามส่งหา `parents.line_user_id` ตรง ๆ. Fan-out แล้ว: class-reminder (cron+RPC), makeup, feedback (ผ่าน `line-queue.ts` — สร้าง payload เองไม่ได้ใช้ sendFeedbackNotification), schedule-change, payment-reminder. Trial/event ส่งหาคนทำรายการคนเดียว (by design). หมายเหตุ: `sendPaymentReminder`/`sendScheduleChangeNotification` ยังไม่มี caller (เขียนเตรียมไว้ ไม่เคยส่งจริง). Log แยกรายผู้รับใน notification_logs (คนที่ 2+ ติดป้าย "ผู้รับเพิ่มเติม").
- เชิญ: LIFF โปรไฟล์ (shareTargetPicker → line.me/R/share → clipboard) หรือหน้าแอดมินผู้ปกครอง (`components/parents/line-recipients-card.tsx` — copy link + QR; ปุ่มแชร์ desktop ใช้ไม่ได้ ถูกถอดแล้ว). ตอบรับผ่าน `/liff?recipientInvite=<token>` — หน้า home ต้อง accept ให้เสร็จ**ก่อน**โหลดข้อมูล (เคยแข่งกันแล้วแว้บ "ยังไม่ได้ลงทะเบียน"), กดลิงก์ซ้ำ = เข้าแอปเงียบ ๆ (ลิงก์คือทางเข้าเดียวของผู้ถูกเชิญ).
- **Account รอง** ใช้ portal ได้เต็ม (ดูตาราง/feedback/แจ้งลา) ผ่าน `resolveFamilyLineId()`/`getParentByLine()` fallback ใน `liff-data.ts` — RPC เดิมไม่ถูกแก้. โปรไฟล์ read-only (`viewerIsSecondary` จาก `/api/liff/profile`): ซ่อนแก้ไข/เพิ่มนักเรียน/จัดการผู้รับ. จัดการผู้รับ = account หลัก + แอดมินเท่านั้น.
- **LINE push ไม่ถึงคนที่ยังไม่เพิ่มเพื่อน OA** — หน้า home มีแบนเนอร์ชวนแอด (`liff.getFriendship()` + `/api/liff/oa-info` ดึง add-friend URL จาก bot/info, cache 1 ชม.).
- **LIFF id ต้องมาจาก `lib/line/liff-id.ts`** (env `NEXT_PUBLIC_LIFF_ID` ไม่ได้ตั้งทั้ง local/Vercel — fallback hardcode `2007575627-GmKBZJdo`) — สร้าง URL จาก env ตรง ๆ เคยได้ลิงก์เชิญพัง `liff.line.me/?...` มาแล้ว.

## Auth / Login
- **Google-only login.** Email/password form is hidden behind `SHOW_PASSWORD_LOGIN = false` in `app/(public)/login/page.tsx` (flip to re-enable). To fully disable, also turn off Email provider in Supabase Auth.
- `useSupabaseAuth`: `signInWithGoogle` (PKCE, redirectTo `/login`), membership guard `enforceAccess` signs out + bounces non-members/inactive. Invite flow at `/invite/[token]`.
- `admin_users.teacher_id` links a login → `teachers` profile; exposed as `adminUser.teacherId`.

## Known Firebase leftovers (tech debt — migrate to Supabase, do NOT bulk-delete; still imported)
- `hooks/useSettings.ts` (Firestore `onSnapshot`), `lib/services/liff-schedule.ts`, `lib/services/link-tokens.ts`, `lib/services/data-cleaning.ts`, `lib/services/factory-reset.ts` still contain Firebase code but are imported by live features — migrate individually.
- Deleted: `lib/services/line-notifications.ts` (dead Firebase). The working notifier is `lib/supabase/services/line-notifications.ts` (server-side, `createServiceClient`); client code must enqueue/use API routes, not import it directly.

## Dashboard Timetable (Time×Room grid)
- Dashboard also shows upcoming-birthday alerts (RPC `get_upcoming_birthdays`, migration `20260718_upcoming_birthdays_rpc`).
- `components/dashboard/daily-timetable.tsx` — full-width table (`w-full`, room cols `min-w-[150px]`); each cell: subject + `(sessionNumber/totalSessions)` inline, de-emphasised class code, teacher avatar (2-char fallback). makeup/trial show student name in the count slot. Dark-mode variants added.
- `components/dashboard/class-detail-dialog.tsx` — compact date `formatThaiShortDate` ("6 มิ.ย. 69 HH:MM - HH:MM"); change teacher in-place (`change-teacher-dialog.tsx` exports `ChangeTeacherPanel`): per-session via `actualTeacherId` (`updateClassSchedule`) or whole-class via `changeClassResources` from this session onward; warns (not blocks) on teacher conflict via `checkAvailability`.

## Shared UI conventions
- `components/ui/tooltip.tsx` — Radix tooltip. Use `<Tooltip label="...">{trigger}</Tooltip>` for ALL hover tooltips (NOT html `title`). `TooltipProvider` is in root `app/layout.tsx`. Pass `label=""` to render children with no tooltip (used for sidebar nav: tooltip only when collapsed). Trigger must forward ref — wrap non-forwarding components (e.g. `MenuLink`) in a `<span>`.
- `Button` size `sm` is `text-sm` (default size stays `text-base`).
- `DateRangePicker` (`mode="single"`) supports `withStepper` → `‹ [picker] ›` prev/next-day buttons; `mode="multiple"` = multi-date selection (used by VEX add-practice).
- `StatusFilterTabs` — shared status-card filter row (ชำระแล้ว/รอชำระ/ยกเลิก/ทั้งหมด style); trial, makeup, and VEX practice pages use it — don't hand-roll status cards.
- `AutocompleteInput` supports `clearOnSelect` (multi-pick mode: picking clears the input, keeps focus for the next search) + `freeInput={false}` to only accept dropdown picks.
- Sidebar (`app/(admin)/layout.tsx`): desktop-collapsible to an icon rail (`sidebarCollapsed`, persisted in localStorage); toggle button lives in the top bar.

## LIFF Parent Portal (Jun 2026 redesign)
Bottom-tab mobile app for parents. Lives in route group `app/liff/(portal)/` (URLs unchanged: `/liff`, `/liff/schedule`, `/liff/feedback`, `/liff/makeup`, `/liff/profile`).
- **Layout** `app/liff/(portal)/layout.tsx`: mounts `LiffProvider` **ONCE** (App Router layout persists across tab switches → LIFF inits once, no re-`updateParent(lastLogin)` per nav) + renders `components/liff/bottom-nav.tsx` (3 fixed tabs: หน้าหลัก/ตารางเรียน/Feedback, with active + tap-loading states). Each page renders its own colored header (`bg-primary text-white p-4 pt-6`) with title (+ back via `router.back()` on sub-pages; tabs have no back).
- **Home** = dashboard (`(portal)/page.tsx`): greeting + avatar→profile, pending-makeup alert, next class, latest feedback. Makeup/profile reached from here.
- **Data access (CRITICAL):** LIFF parents auth via LINE, **not Supabase Auth** → browser anon client is RLS-blocked on enrollments/class_schedules/makeup_classes. ALL reads go through **server routes** `app/api/liff/*` (service role) that resolve identity from a **verified LINE ID token**:
  - `lib/line/verify-liff-token.ts` — `resolveLiffUser(req, body)`: verifies `Authorization: Bearer <liff.getIDToken()>` against LINE (`client_id` = numeric prefix of `NEXT_PUBLIC_LIFF_ID` = `2007575627`), caches results 10 min; **falls back to unverified `body.lineUserId`** if no/invalid token (so it works even if `openid` scope is off). ⚠️ every mutation/read body must still send `lineUserId` for the fallback.
  - `lib/line/liff-fetch.ts` — client `liffFetch(path, body)` attaches the Bearer token; use it on every LIFF page (NOT direct Supabase services).
  - `lib/supabase/services/liff-data.ts` — unified server data layer; `getHomeSummary` / `getParentScheduleEvents` / `getFeedbackData` / `getMakeupData` / `getProfileData` each call **ONE Postgres RPC** (`get_liff_home` / `get_liff_schedule` / `get_liff_feedback` / `get_liff_makeup` / `get_liff_profile`) → 1 DB round-trip (was 10–20 sequential queries). RPCs do the JOINs + return JSON (camelCase keys); presentation logic (event colours/status, makeup quota/stats) stays in TS. Mutations: `requestLeave` / `cancelLeave` (+ `updateParentProfile`) with per-student ownership checks. `getPendingMakeupCount` is the only plain query.
- **Client cache** `lib/line/liff-cache.ts`: in-memory (module scope) so switching tabs shows last data instantly then revalidates silently — pages init state from cache and only show the loader when there's no data yet (never `setLoading(true)` on revalidate).
- **Conventions:** never show class **codes** to parents — show `subjectName` (class `name` is the code, e.g. `VEXIQ1-2026MAY-SUN-MOR2`). Student name → shared `components/ui/student-badge.tsx`. One full-screen loader everywhere: `Loading`/`PageLoading` (logo + "กำลังโหลด...", size `lg`, `z-[60]` so it covers the bottom nav). Parent name is `display_name` (editable) vs `line_display_name` (real LINE name) — shown separately on profile.
- **Gotchas:** `enrollments` has TWO FKs to `classes` (`class_id` + `transferred_from`) → PostgREST `classes(*)` embed is ambiguous, must hint `classes!enrollments_class_id_fkey(*)`. Light theme had `--secondary/--muted/--accent` set to dark navy → outline/ghost buttons flashed dark on press; fixed with a scoped `.liff-theme` override (in `globals.css`, applied on `app/liff/layout.tsx`) — also softens borders for a frame-light look. Marking a session "present" auto-removes its makeup (present = attended), so the dashboard makeup alert is data-driven (0 → hidden).

## VEX Team Module
- Admin `/vexteam` — sidebar submenu ทีม / การแข่งขัน (`/vexteam/events`) / ตารางซ้อม (`/vexteam/practices`), role super_admin+branch_admin, branch-scoped. Badge คำขอซ้อมค้างอนุมัติ poll `/api/admin/vex/practices?status=proposed` ทุก 2 นาที (+ event `vex-practices-changed`).
- ข้อมูลอยู่ใน **Postgres schema แยก `vex.*`** (ไม่ใช่ public) — types/labels ที่ `lib/vex/types.ts`, levels: iq_elem/iq_ms/v5_ms/v5_hs (v5_uni ยังอยู่ใน DB enum แต่ตัดจาก UI). Helpers ใน `lib/vex/`: api, audit (vex.audit_log), notify (LINE), tokens, public-team, team-session, liff-context, event-timeline. API routes ใต้ `app/api/admin/vex/*` (staff) + public team routes.
- **Team portal `/team` = LIFF app ตัวที่ 2** (`NEXT_PUBLIC_VEX_LIFF_ID` = `2007575627-H1S0B2mi`, endpoint `/team`) — `app/team/` มี layout + LiffUpgradeGate (`?li=1` marker) + line-gate + team-bottom-nav; `externalBrowserLogin=false` (ดู memory: liff-login-redirect-traps). ลิงก์ทีม resolve ด้วย **secret token เท่านั้น** — team number ใน slug เป็นแค่ cosmetic (เปลี่ยนชื่อทีมแล้วลิงก์เก่าไม่พัง).
- ตารางซ้อม: ผู้ปกครองเสนอเวลาจากหน้า team → สถานะ proposed → แอดมิน อนุมัติ/แก้เวลา+อนุมัติ ("บันทึก + อนุมัติ") → LINE noti; แอดมินเพิ่มซ้อมเอง = auto-approved (`add-practice-dialog.tsx` — ค้นเด็ก, multi-date, ทั้งทีม). การแข่งขันมี RSVP → admin roster page (ทีม×นักเรียน matrix + CSV export).
- รายงาน `/reports/vex-team` — โรงเรียน/อายุ/คอร์สที่เคยเรียนของเด็กในทีม, single RPC (migration `20260718_vex_team_report_rpc`).
