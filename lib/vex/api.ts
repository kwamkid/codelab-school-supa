// lib/vex/api.ts
// Server-side helpers shared by the VEX API routes: admin auth + parent identity.

import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { restSelect } from '@/lib/supabase/rest'

/** Roles allowed to manage VEX teams. Teachers are excluded (per project decision). */
const VEX_ADMIN_ROLES = ['super_admin', 'branch_admin'] as const

export interface VexAdmin {
  ok: boolean
  adminId?: string
  authUserId?: string
  role?: string
  name?: string
  status?: 401 | 403
  error?: string
}

/**
 * Verify the request carries a Bearer token for an active super_admin/branch_admin.
 * Also loads the admin's display name for audit rows.
 */
export async function requireAdmin(request: Request): Promise<VexAdmin> {
  const staff = await requireStaff(bearer(request.headers.get('authorization')))
  if (!staff.ok) {
    return { ok: false, status: staff.status ?? 401, error: staff.error }
  }
  if (!staff.role || !VEX_ADMIN_ROLES.includes(staff.role as any)) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  // Best-effort display name for audit (non-fatal).
  let name: string | undefined
  try {
    const rows = await restSelect<{ name?: string }>('admin_users', {
      id: `eq.${staff.adminId}`,
      select: 'name',
      limit: '1',
    })
    name = rows?.[0]?.name
  } catch {
    // ignore — audit name is optional
  }

  return { ok: true, adminId: staff.adminId, authUserId: staff.authUserId, role: staff.role, name }
}

export interface VexParent {
  id: string
  displayName: string | null
}

/**
 * Look up a codelab parent by their LINE userId (server-side, service role).
 * Uses direct PostgREST (the browser-client getParentByLineId throws server-side).
 * Returns null for an unregistered LINE user.
 */
export async function getVexParentByLineId(lineUserId: string): Promise<VexParent | null> {
  const rows = await restSelect<{
    id: string
    display_name: string | null
    line_display_name: string | null
  }>('parents', {
    line_user_id: `eq.${lineUserId}`,
    select: 'id,display_name,line_display_name',
    limit: '1',
  })
  const p = rows?.[0]
  if (!p) return null
  return { id: p.id, displayName: p.display_name || p.line_display_name || null }
}
