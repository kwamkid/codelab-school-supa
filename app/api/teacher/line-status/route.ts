// app/api/teacher/line-status/route.ts
// GET    → is the logged-in teacher's LINE account linked? (+ OA add-friend url)
// DELETE → unlink (clears teachers.line_user_id)
//
// "Linked" means a real pushable userId (U + 32 hex) — the column also holds
// legacy hand-typed e-mails/LINE IDs, see lib/line/line-user-id.ts.

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isLineUserId } from '@/lib/line/line-user-id'

export const dynamic = 'force-dynamic'

async function resolveTeacherId(): Promise<{ teacherId?: string; error?: string; status?: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }

  const svc = createServiceClient()
  const { data: adminUser } = await svc
    .from('admin_users')
    .select('teacher_id, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!adminUser?.is_active) return { error: 'Forbidden', status: 403 }
  if (!adminUser.teacher_id) return { error: 'no_teacher_profile', status: 404 }
  return { teacherId: adminUser.teacher_id }
}

export async function GET() {
  const resolved = await resolveTeacherId()
  if (!resolved.teacherId) {
    // Not a teacher account → nothing to prompt, don't treat as an error client-side.
    return NextResponse.json({ linked: false, applicable: false }, { status: 200 })
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

export async function DELETE() {
  const resolved = await resolveTeacherId()
  if (!resolved.teacherId) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status || 400 })
  }

  const svc = createServiceClient()
  const { error } = await svc.from('teachers').update({ line_user_id: null }).eq('id', resolved.teacherId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
