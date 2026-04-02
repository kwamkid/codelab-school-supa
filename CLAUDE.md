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
