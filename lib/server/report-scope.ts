import { requireStaffScope, bearer } from '@/lib/server/admin-auth'

// Shape kept flat (project has `strict: false`; union narrowing is unreliable).
interface ReportScope {
  ok: boolean
  error?: string
  status?: 400 | 401 | 403
  /** Branch to filter by (clamped). null = no single-branch filter. */
  branchId?: string | null
  /** Branches the caller may see when branchId is null. null = every branch. */
  branchIds?: string[] | null
}

/**
 * Guard for /api/reports/* (รายงาน pages = super_admin + branch_admin only).
 * Rejects teachers and clamps branch admins to their own branches:
 *  - requested branch outside their scope → 403
 *  - no branch requested → their only branch, or `branchIds` for an IN filter
 */
export async function requireReportScope(
  authHeader: string | null,
  requestedBranchId: string | null,
): Promise<ReportScope> {
  const scope = await requireStaffScope(bearer(authHeader))
  if (!scope.ok) return { ok: false, error: scope.error, status: scope.status }
  if (scope.role === 'teacher') return { ok: false, error: 'Forbidden', status: 403 }

  const allowed = scope.branchIds ?? null
  if (allowed === null) return { ok: true, branchId: requestedBranchId || null, branchIds: null }
  if (allowed.length === 0) return { ok: false, error: 'Forbidden', status: 403 }

  if (requestedBranchId) {
    if (!allowed.includes(requestedBranchId)) return { ok: false, error: 'Forbidden', status: 403 }
    return { ok: true, branchId: requestedBranchId, branchIds: [requestedBranchId] }
  }
  if (allowed.length === 1) return { ok: true, branchId: allowed[0], branchIds: allowed }
  return { ok: true, branchId: null, branchIds: allowed }
}
