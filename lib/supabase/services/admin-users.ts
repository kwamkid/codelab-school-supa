import { createServiceClient } from '../server'
import type {
  AdminUser,
  InsertTables,
  UpdateTables,
  AdminRole
} from '@/types/supabase'

// ============================================
// GET ADMIN USERS
// ============================================

// Get all admin users (excluding teachers by default)
export async function getAdminUsers(branchId?: string): Promise<AdminUser[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('admin_users')
    .select('*')
    .in('role', ['super_admin', 'branch_admin'])
    .order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error('Error getting admin users:', error)
    throw error
  }

  let users = data || []

  // Filter by branch if specified
  if (branchId) {
    users = users.filter(user => {
      // Super admin can see all
      if (user.role === 'super_admin') return true
      // Check if user has access to this branch
      return user.branch_ids.length === 0 || user.branch_ids.includes(branchId)
    })
  }

  return users
}

// Get all users including teachers
export async function getAllAdminUsers(branchId?: string): Promise<AdminUser[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error('Error getting all admin users:', error)
    throw error
  }

  let users = data || []

  // Filter by branch if specified
  if (branchId) {
    users = users.filter(user => {
      if (user.role === 'super_admin') return true
      return user.branch_ids.length === 0 || user.branch_ids.includes(branchId)
    })
  }

  return users
}

// Get admin users by role
export async function getAdminUsersByRole(
  role: AdminRole,
  branchId?: string
): Promise<AdminUser[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('role', role)
    .eq('is_active', true)
    .order('display_name', { ascending: true })

  if (error) {
    console.error('Error getting admin users by role:', error)
    return []
  }

  let users = data || []

  // Filter by branch if specified (not for super_admin)
  if (branchId && role !== 'super_admin') {
    users = users.filter(user =>
      user.branch_ids.length === 0 || user.branch_ids.includes(branchId)
    )
  }

  return users
}

// Get teachers for a specific branch
export async function getTeachersForBranch(branchId: string): Promise<AdminUser[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('role', 'teacher')
    .eq('is_active', true)

  if (error) {
    console.error('Error getting teachers for branch:', error)
    return []
  }

  // Filter by branch
  const teachers = (data || []).filter(teacher =>
    teacher.branch_ids.length === 0 || teacher.branch_ids.includes(branchId)
  )

  return teachers
}

// Get admin user by ID
export async function getAdminUser(userId: string): Promise<AdminUser | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting admin user:', error)
    throw error
  }

  return data
}

// Get admin user by auth user ID (Supabase Auth)
export async function getAdminUserByAuthId(authUserId: string): Promise<AdminUser | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting admin user by auth ID:', error)
    return null
  }

  return data
}

// Get admin user by email
export async function getAdminUserByEmail(email: string): Promise<AdminUser | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting admin user by email:', error)
    return null
  }

  return data
}

// ============================================
// CREATE / UPDATE / DELETE
// ============================================

// Create admin user (after Supabase Auth user is created)
export async function createAdminUser(
  authUserId: string,
  userData: {
    email: string
    display_name: string
    role: AdminRole
    branch_ids: string[]
    teacher_id?: string
    permissions?: {
      can_manage_users?: boolean
      can_manage_settings?: boolean
      can_view_reports?: boolean
      can_manage_all_branches?: boolean
    }
  },
  createdBy: string
): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('admin_users')
    .insert({
      auth_user_id: authUserId,
      email: userData.email.toLowerCase(),
      display_name: userData.display_name,
      role: userData.role,
      branch_ids: userData.branch_ids,
      teacher_id: userData.teacher_id || null,
      permissions: userData.permissions || {
        can_manage_users: userData.role === 'super_admin',
        can_manage_settings: userData.role === 'super_admin',
        can_view_reports: true,
        can_manage_all_branches: userData.role === 'super_admin'
      },
      is_active: true,
      created_by: createdBy,
      updated_by: createdBy
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating admin user:', error)
    throw error
  }

  return data.id
}

// Create admin user with Supabase Auth
export async function createAdminUserWithAuth(
  email: string,
  password: string,
  userData: {
    display_name: string
    role: AdminRole
    branch_ids: string[]
    teacher_id?: string
    permissions?: {
      can_manage_users?: boolean
      can_manage_settings?: boolean
      can_view_reports?: boolean
      can_manage_all_branches?: boolean
    }
  },
  createdBy: string
): Promise<string> {
  const supabase = createServiceClient()

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true
  })

  if (authError || !authData.user) {
    console.error('Error creating auth user:', authError)
    throw authError || new Error('Failed to create auth user')
  }

  // Create admin user record
  const adminUserId = await createAdminUser(
    authData.user.id,
    { email, ...userData },
    createdBy
  )

  return adminUserId
}

// Create admin user simple (for migration or manual creation)
export async function createAdminUserSimple(
  userId: string,
  userData: {
    email: string
    display_name: string
    role: AdminRole
    branch_ids: string[]
    auth_user_id?: string
    teacher_id?: string
    permissions?: {
      can_manage_users?: boolean
      can_manage_settings?: boolean
      can_view_reports?: boolean
      can_manage_all_branches?: boolean
    }
    is_active: boolean
  },
  createdBy: string
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('admin_users')
    .upsert({
      id: userId,
      auth_user_id: userData.auth_user_id || null,
      email: userData.email.toLowerCase(),
      display_name: userData.display_name,
      role: userData.role,
      branch_ids: userData.branch_ids,
      teacher_id: userData.teacher_id || null,
      permissions: userData.permissions || {},
      is_active: userData.is_active,
      created_by: createdBy,
      updated_by: createdBy
    })

  if (error) {
    console.error('Error creating admin user simple:', error)
    throw error
  }
}

// Update admin user
export async function updateAdminUser(
  userId: string,
  data: Partial<UpdateTables<'admin_users'>>,
  updatedBy: string
): Promise<void> {
  const supabase = createServiceClient()

  // Remove fields that shouldn't be updated directly
  const { id: _, auth_user_id: __, created_at: ___, created_by: ____, ...updateData } = data as AdminUser

  const { error } = await supabase
    .from('admin_users')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy
    })
    .eq('id', userId)

  if (error) {
    console.error('Error updating admin user:', error)
    throw error
  }
}

// Toggle admin user active status
export async function toggleAdminUserStatus(
  userId: string,
  isActive: boolean,
  updatedBy: string
): Promise<void> {
  await updateAdminUser(userId, { is_active: isActive }, updatedBy)
}

// Delete admin user (soft delete)
export async function deleteAdminUser(
  userId: string,
  deletedBy: string
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('admin_users')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
      updated_by: deletedBy
    })
    .eq('id', userId)

  if (error) {
    console.error('Error deleting admin user:', error)
    throw error
  }
}

// Hard delete admin user
export async function hardDeleteAdminUser(userId: string): Promise<void> {
  const supabase = createServiceClient()

  // Get admin user to find auth_user_id
  const adminUser = await getAdminUser(userId)

  // Delete admin_users record
  const { error: deleteError } = await supabase
    .from('admin_users')
    .delete()
    .eq('id', userId)

  if (deleteError) {
    console.error('Error hard deleting admin user:', deleteError)
    throw deleteError
  }

  // Delete auth user if exists
  if (adminUser?.auth_user_id) {
    const { error: authError } = await supabase.auth.admin.deleteUser(
      adminUser.auth_user_id
    )

    if (authError) {
      console.error('Error deleting auth user:', authError)
      // Don't throw - admin_users record is already deleted
    }
  }
}

// ============================================
// VALIDATION
// ============================================

// Check if email already exists
export async function checkEmailExists(
  email: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = createServiceClient()

  let query = supabase
    .from('admin_users')
    .select('id')
    .eq('email', email.toLowerCase())

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error checking email:', error)
    return false
  }

  return (data?.length || 0) > 0
}

// ============================================
// PASSWORD MANAGEMENT
// ============================================

// Send password reset email
export async function sendPasswordReset(email: string): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`
  })

  if (error) {
    console.error('Error sending password reset:', error)
    throw error
  }
}

// Update user password (admin function)
export async function updateUserPassword(
  authUserId: string,
  newPassword: string
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    password: newPassword
  })

  if (error) {
    console.error('Error updating user password:', error)
    throw error
  }
}

// ============================================
// PERMISSIONS
// ============================================

// Check if user has permission
export function hasPermission(
  user: AdminUser,
  permission: keyof NonNullable<AdminUser['permissions']>
): boolean {
  if (user.role === 'super_admin') return true
  return user.permissions?.[permission] || false
}

// Check if user has branch access
export function hasBranchAccess(user: AdminUser, branchId: string): boolean {
  if (user.role === 'super_admin') return true
  if (user.permissions?.can_manage_all_branches) return true
  return user.branch_ids.length === 0 || user.branch_ids.includes(branchId)
}

// Get accessible branch IDs for user
export async function getAccessibleBranchIds(userId: string): Promise<string[]> {
  const user = await getAdminUser(userId)
  if (!user) return []

  if (user.role === 'super_admin' || user.permissions?.can_manage_all_branches) {
    // Return all active branches
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('branches')
      .select('id')
      .eq('is_active', true)

    return data?.map(b => b.id) || []
  }

  return user.branch_ids
}

// ============================================
// STATISTICS
// ============================================

// Get admin user counts by role
export async function getAdminUserCounts(): Promise<{
  total: number
  superAdmins: number
  branchAdmins: number
  teachers: number
  active: number
  inactive: number
}> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('admin_users')
    .select('role, is_active')

  if (error || !data) {
    return {
      total: 0,
      superAdmins: 0,
      branchAdmins: 0,
      teachers: 0,
      active: 0,
      inactive: 0
    }
  }

  return {
    total: data.length,
    superAdmins: data.filter(u => u.role === 'super_admin').length,
    branchAdmins: data.filter(u => u.role === 'branch_admin').length,
    teachers: data.filter(u => u.role === 'teacher').length,
    active: data.filter(u => u.is_active).length,
    inactive: data.filter(u => !u.is_active).length
  }
}

// ============================================
// SEARCH
// ============================================

// Search admin users
export async function searchAdminUsers(
  searchTerm: string,
  options?: {
    role?: AdminRole
    branchId?: string
    isActive?: boolean
  }
): Promise<AdminUser[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('admin_users')
    .select('*')

  // Apply filters
  if (options?.role) {
    query = query.eq('role', options.role)
  }

  if (options?.isActive !== undefined) {
    query = query.eq('is_active', options.isActive)
  }

  // Search by name or email
  query = query.or(`display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)

  const { data, error } = await query.order('display_name', { ascending: true })

  if (error) {
    console.error('Error searching admin users:', error)
    return []
  }

  let users = data || []

  // Filter by branch if specified
  if (options?.branchId) {
    users = users.filter(user => {
      if (user.role === 'super_admin') return true
      return user.branch_ids.length === 0 || user.branch_ids.includes(options.branchId!)
    })
  }

  return users
}
