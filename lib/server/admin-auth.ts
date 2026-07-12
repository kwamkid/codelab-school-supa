import { createClient } from '@supabase/supabase-js'
import { restSelect } from '@/lib/supabase/rest'

// Single shape (no discriminated union) — this project has `strict: false`,
// so union narrowing on `ok` is unreliable. On error, `error`/`status` are set.
interface SuperAdminResult {
  ok: boolean
  authUserId?: string
  adminId?: string
  error?: string
  status?: 401 | 403
}

/**
 * Verify a Supabase access token belongs to an active super_admin.
 * Returns the caller's admin_users.id on success.
 */
export async function requireSuperAdmin(token: string | null): Promise<SuperAdminResult> {
  if (!token) return { ok: false, error: 'Unauthorized', status: 401 }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return { ok: false, error: 'Unauthorized', status: 401 }

  const rows = await restSelect<{ id: string; role: string; is_active: boolean }>('admin_users', {
    auth_user_id: `eq.${user.id}`,
    select: 'id,role,is_active',
    limit: '1',
  })
  const me = rows?.[0]
  if (!me || me.role !== 'super_admin' || me.is_active === false) {
    return { ok: false, error: 'Forbidden', status: 403 }
  }
  return { ok: true, authUserId: user.id, adminId: me.id }
}

interface StaffResult {
  ok: boolean
  authUserId?: string
  adminId?: string
  role?: 'super_admin' | 'branch_admin' | 'teacher'
  error?: string
  status?: 401 | 403
}

/**
 * Verify a Supabase access token belongs to any active staff member
 * (teacher, branch_admin, or super_admin). Used for quiz/teaching authoring.
 */
export async function requireStaff(token: string | null): Promise<StaffResult> {
  if (!token) return { ok: false, error: 'Unauthorized', status: 401 }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return { ok: false, error: 'Unauthorized', status: 401 }

  const rows = await restSelect<{ id: string; role: any; is_active: boolean }>('admin_users', {
    auth_user_id: `eq.${user.id}`,
    select: 'id,role,is_active',
    limit: '1',
  })
  const me = rows?.[0]
  if (!me || me.is_active === false) return { ok: false, error: 'Forbidden', status: 403 }
  return { ok: true, authUserId: user.id, adminId: me.id, role: me.role }
}

/** Extract a Bearer token from an Authorization header value. */
export function bearer(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length)
}
