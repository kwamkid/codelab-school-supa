import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { requireSuperAdmin, bearer } from '@/lib/server/admin-auth'
import { restSelect, restInsert } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

// GET — list all invitations (super admin only)
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const rows = await restSelect('admin_invitations', {
      select: '*',
      order: 'created_at.desc',
    })
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — create a new invitation (super admin only)
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const {
      role,
      branchIds = [],
      permissions = {},
      subjectIds = [],
      expiresInDays = 1,
    } = body

    if (!role || !['super_admin', 'branch_admin', 'teacher'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    // The invitation only carries permissions. Name/nickname/phone are entered by
    // the invitee on the /invite page at accept time.

    const token = randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

    // super_admin gets all permissions; others use the provided flags
    const isSuper = role === 'super_admin'

    // Teacher's subjects (specialties) are carried on the invite so the profile
    // is fully set up the moment they accept — no separate admin step needed.
    const teacherData =
      role === 'teacher' && Array.isArray(subjectIds) && subjectIds.length > 0
        ? { specialties: subjectIds }
        : null

    const [created] = await restInsert('admin_invitations', {
      token,
      role,
      branch_ids: isSuper ? [] : branchIds,
      can_manage_users: isSuper ? true : !!permissions.canManageUsers,
      can_manage_settings: isSuper ? true : !!permissions.canManageSettings,
      can_view_reports: isSuper ? true : !!permissions.canViewReports,
      can_manage_all_branches: isSuper ? true : !!permissions.canManageAllBranches,
      teacher_data: teacherData,
      created_by: auth.adminId,
      expires_at: expiresAt,
    })

    return NextResponse.json({
      success: true,
      invitation: created,
      url: `${APP_URL}/invite/${token}`,
    })
  } catch (err: any) {
    console.error('[invitations] create error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
