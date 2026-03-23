# CodeLab School Supa - Project Memory

## User
- [Company Info](memory/user_company.md) - KID POWER COMPANY LIMITED, Tax ID, domains

## Feedback
- [Login signOut ref bug](memory/bug_login_signout_ref.md) - signOut must reset loadedEmailRef/loadingAdminRef and call supabase.auth.signOut()

## Architecture
- Next.js app with Supabase backend
- `adminMutation` pattern: client calls `/api/admin/mutation` with service role to bypass RLS
- ALLOWED_TABLES whitelist in `app/api/admin/mutation/route.ts`
- Use `as any` casts for tables not in generated Database types
- **CRITICAL BUG**: Supabase JS client `.eq()` does NOT work on tables not in generated Database types → use direct PostgREST fetch for server-side API routes
- BranchContext provides `selectedBranchId`, NOT `branches` array — load via `getBranches()`

## Key Patterns
- `useRef` guard for preventing double-submit
- Payment transactions stored in separate `payment_transactions` table with auto-recalculation
- `AdminUser.branchIds` (plural array), not `branchId`
- `updateTrialSession(sessionId, data)` — takes 2 args (NOT bookingId, sessionId, data)
- `updateBookingStatus` (not `updateTrialBookingStatus`)
- `TrialBooking` has no `sessions` field — load via `getTrialSessionsByBooking(bookingId)`

## User Preferences
- New pages must use `text-base` (16px) font, NOT `text-sm`/`text-xs`
- Support multiple students per parent in enrollment
- Settings are sub-pages under `/settings/*`, not tabs

## Completed Features (Mar 2026)
- Walk-in trial: auto-sets status='contacted'
- Payment system: `payment_transactions` + `branch_payment_settings` tables
- Settings restructure: tabs → sub-pages (`/settings/general`, `/settings/payment`, etc.)
- Payment UI in enrollment detail (summary card, transaction list, add-payment dialog)
- Unified enrollment page: 5-step wizard at `/enrollments/new`
- Trial detail "ลงทะเบียน" → redirects to `/enrollments/new?from=trial&bookingId=&sessionId=`
