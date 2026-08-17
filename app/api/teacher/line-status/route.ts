// app/api/teacher/line-status/route.ts
// GET    → is the logged-in teacher's LINE account linked?
// DELETE → unlink (clears teachers.line_user_id)
//
// Auth = Bearer access token via authFetch, like every other protected route
// here. (The browser client stores its session in localStorage, NOT cookies —
// a cookie-reading server client sees no user and would silently answer
// "not a teacher".)
//
// "Linked" means a real pushable userId (U + 32 hex) — the column also holds
// legacy hand-typed e-mails/LINE IDs, see lib/line/line-user-id.ts.

import { NextResponse } from 'next/server'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { isLineUserId } from '@/lib/line/line-user-id'

export const dynamic = 'force-dynamic'

async function resolveTeacherId(
  request: Request
): Promise<{ teacherId?: string; error?: string; status?: number }> {
  const staff = await requireStaff(bearer(request.headers.get('authorization')))
  if (!staff.ok) return { error: staff.error, status: staff.status ?? 401 }

  const svc = createServiceClient()
  const { data: adminUser } = await svc
    .from('admin_users')
    .select('teacher_id')
    .eq('id', staff.adminId!)
    .maybeSingle()
  if (!adminUser?.teacher_id) return { error: 'no_teacher_profile', status: 404 }
  return { teacherId: adminUser.teacher_id }
}

export async function GET(request: Request) {
  const resolved = await resolveTeacherId(request)
  if (!resolved.teacherId) {
    // Not a teacher account (or not signed in) → nothing to prompt.
    return NextResponse.json({ linked: false, applicable: false })
  }

  const svc = createServiceClient()
  const { data: teacher } = await svc
    .from('teachers')
    .select('id, line_user_id')
    .eq('id', resolved.teacherId)
    .maybeSingle()

  return NextResponse.json({
    applicable: true,
    linked: isLineUserId(teacher?.line_user_id),
  })
}

export async function DELETE(request: Request) {
  const resolved = await resolveTeacherId(request)
  if (!resolved.teacherId) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status || 400 })
  }

  const svc = createServiceClient()
  const { error } = await svc.from('teachers').update({ line_user_id: null }).eq('id', resolved.teacherId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
