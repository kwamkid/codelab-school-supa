import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, bearer } from '@/lib/server/admin-auth'
import { restPatch } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

// DELETE — revoke an invitation (super admin only). Soft: sets revoked_at.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params

  try {
    const updated = await restPatch(
      'admin_invitations',
      { id: `eq.${id}` },
      {
        revoked_at: new Date().toISOString(),
        revoked_by: auth.adminId,
      }
    )
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ invitation' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[invitations] revoke error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
