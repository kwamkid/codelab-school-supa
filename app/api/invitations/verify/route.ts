import { NextRequest, NextResponse } from 'next/server'
import { restSelect } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

// GET ?token=... — public preview of an invitation for the /invite landing page.
// Returns role + branch names so the invitee can see what they're accepting.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) {
    return NextResponse.json({ valid: false, reason: 'missing_token' }, { status: 400 })
  }

  try {
    const rows = await restSelect('admin_invitations', {
      token: `eq.${token}`,
      select: '*',
      limit: '1',
    })
    const inv = rows?.[0]

    if (!inv) {
      return NextResponse.json({ valid: false, reason: 'not_found' })
    }
    if (inv.revoked_at) {
      return NextResponse.json({ valid: false, reason: 'revoked' })
    }
    if (inv.used_at) {
      return NextResponse.json({ valid: false, reason: 'used' })
    }
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ valid: false, reason: 'expired' })
    }

    // Resolve branch names for display
    let branchNames: string[] = []
    const branchIds: string[] = inv.branch_ids || []
    if (!inv.can_manage_all_branches && branchIds.length > 0) {
      const branches = await restSelect<{ id: string; name: string }>('branches', {
        id: `in.(${branchIds.join(',')})`,
        select: 'id,name',
      })
      branchNames = branches.map((b) => b.name)
    }

    return NextResponse.json({
      valid: true,
      role: inv.role,
      displayName: inv.display_name,
      email: inv.email,
      allBranches: inv.can_manage_all_branches || inv.role === 'super_admin' || branchIds.length === 0,
      branchNames,
      expiresAt: inv.expires_at,
    })
  } catch (err: any) {
    console.error('[invitations] verify error:', err)
    return NextResponse.json({ valid: false, reason: 'error' }, { status: 500 })
  }
}
