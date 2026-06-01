// Client service for the admin/teacher invite-link system.
import { getClient } from '@/lib/supabase/client'

export interface AdminInvitation {
  id: string
  token: string
  email: string | null
  display_name: string | null
  nickname: string | null
  role: 'super_admin' | 'branch_admin' | 'teacher'
  branch_ids: string[]
  can_manage_users: boolean
  can_manage_settings: boolean
  can_view_reports: boolean
  can_manage_all_branches: boolean
  teacher_data: { nickname?: string; phone?: string; specialties?: string[] } | null
  created_by: string | null
  created_at: string
  expires_at: string
  used_at: string | null
  used_by_email: string | null
  revoked_at: string | null
}

export interface CreateInvitationInput {
  role: 'super_admin' | 'branch_admin' | 'teacher'
  branchIds?: string[]
  permissions?: {
    canManageUsers?: boolean
    canManageSettings?: boolean
    canViewReports?: boolean
    canManageAllBranches?: boolean
  }
  expiresInDays?: number
}

/** Profile the invitee fills in on the /invite page before accepting. */
export interface AcceptInvitationProfile {
  displayName?: string
  nickname?: string
  phone?: string
}

export interface InvitationPreview {
  valid: boolean
  reason?: string
  role?: 'super_admin' | 'branch_admin' | 'teacher'
  displayName?: string | null
  email?: string | null
  allBranches?: boolean
  branchNames?: string[]
  expiresAt?: string
}

async function getAuthToken(): Promise<string> {
  const supabase = getClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No auth session')
  return session.access_token
}

// --- Super-admin management calls ---

export async function getInvitations(): Promise<AdminInvitation[]> {
  const token = await getAuthToken()
  const res = await fetch('/api/admin/invitations', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load invitations')
  }
  return res.json()
}

export async function createInvitation(
  input: CreateInvitationInput
): Promise<{ invitation: AdminInvitation; url: string }> {
  const token = await getAuthToken()
  const res = await fetch('/api/admin/invitations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || 'Failed to create invitation')
  return result
}

export async function revokeInvitation(id: string): Promise<void> {
  const token = await getAuthToken()
  const res = await fetch(`/api/admin/invitations/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to revoke invitation')
  }
}

// --- Public / invitee calls ---

export async function verifyInvitation(token: string): Promise<InvitationPreview> {
  const res = await fetch(`/api/invitations/verify?token=${encodeURIComponent(token)}`, {
    cache: 'no-store',
  })
  return res.json()
}

/** Accept the invitation using the current Google session. Must be signed in first. */
export async function acceptInvitation(
  token: string,
  profile: AcceptInvitationProfile = {}
): Promise<void> {
  const accessToken = await getAuthToken()
  const res = await fetch('/api/invitations/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, accessToken, ...profile }),
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(result.error || 'Failed to accept invitation')
}

/** Build the human-readable label for a role. */
export function roleLabel(role?: string): string {
  switch (role) {
    case 'super_admin': return 'Super Admin'
    case 'branch_admin': return 'Branch Admin'
    case 'teacher': return 'ครูผู้สอน (Teacher)'
    default: return role || '-'
  }
}

/** Status of an invitation for list display. */
export function invitationStatus(inv: AdminInvitation): 'used' | 'revoked' | 'expired' | 'active' {
  if (inv.used_at) return 'used'
  if (inv.revoked_at) return 'revoked'
  if (new Date(inv.expires_at).getTime() < Date.now()) return 'expired'
  return 'active'
}
