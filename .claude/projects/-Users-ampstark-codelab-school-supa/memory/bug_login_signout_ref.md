---
name: Login bug - signOut not resetting refs
description: Recurring login bug where signOut doesn't reset loadedEmailRef causing re-login to fail with "ไม่พบข้อมูลผู้ดูแลระบบ"
type: feedback
---

signOut() in useSupabaseAuth.tsx must reset `loadedEmailRef.current = null` and `loadingAdminRef.current = false`, and must call `supabase.auth.signOut()`.

**Why:** Without resetting refs, `loadAdminUser()` sees `loadedEmailRef.current === emailLower` and returns early without loading admin data. The `adminUser` state stays null (cleared by signOut), causing admin layout to show "ไม่พบข้อมูลผู้ดูแลระบบ". This bug has occurred multiple times (fixed in commit 9c81936 partially, but signOut refs were missed).

**How to apply:** When touching auth/signOut logic, always ensure all refs (loadedEmailRef, loadingAdminRef) are reset AND `supabase.auth.signOut()` is called to invalidate the session properly.
