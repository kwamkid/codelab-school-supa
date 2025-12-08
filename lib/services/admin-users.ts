// lib/services/admin-users.ts
import { AdminUser } from '@/types/models';
import { getClient } from '@/lib/supabase/client';

// Type for database row
interface AdminUserRow {
  id: string;
  auth_user_id: string | null;
  email: string;
  display_name: string;
  role: 'super_admin' | 'branch_admin' | 'teacher';
  branch_ids: string[];
  teacher_id: string | null;
  can_manage_users: boolean | null;
  can_manage_settings: boolean | null;
  can_view_reports: boolean | null;
  can_manage_all_branches: boolean | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
}

// Map database row to AdminUser model
function mapToAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    branchIds: row.branch_ids || [],
    teacherId: row.teacher_id || undefined,
    permissions: {
      canManageUsers: row.can_manage_users ?? false,
      canManageSettings: row.can_manage_settings ?? false,
      canViewReports: row.can_view_reports ?? false,
      canManageAllBranches: row.can_manage_all_branches ?? false,
    },
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    updatedBy: row.updated_by || undefined,
  };
}

// Get all admin users with optional branch filter (excluding teachers)
export async function getAdminUsers(branchId?: string): Promise<AdminUser[]> {
  try {
    const supabase = getClient();

    let query = supabase
      .from('admin_users')
      .select('*')
      .in('role', ['super_admin', 'branch_admin'])
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    let users = (data || []).map(row => mapToAdminUser(row as AdminUserRow));

    // Filter by branch if specified
    if (branchId) {
      users = users.filter(user => {
        // Super admin can see all
        if (user.role === 'super_admin') return true;
        // Check if user has access to this branch
        return user.branchIds.length === 0 || user.branchIds.includes(branchId);
      });
    }

    return users;
  } catch (error) {
    console.error('Error getting admin users:', error);
    throw error;
  }
}

// Get admin users by role
export async function getAdminUsersByRole(
  role: 'super_admin' | 'branch_admin' | 'teacher',
  branchId?: string
): Promise<AdminUser[]> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('role', role)
      .eq('is_active', true)
      .order('display_name', { ascending: true });

    if (error) throw error;

    let users = (data || []).map(row => mapToAdminUser(row as AdminUserRow));

    // Filter by branch if specified
    if (branchId && role !== 'super_admin') {
      users = users.filter(user =>
        user.branchIds.length === 0 || user.branchIds.includes(branchId)
      );
    }

    return users;
  } catch (error) {
    console.error('Error getting admin users by role:', error);
    return [];
  }
}

// Get teachers for a specific branch
export async function getTeachersForBranch(branchId: string): Promise<AdminUser[]> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('role', 'teacher')
      .eq('is_active', true);

    if (error) throw error;

    const teachers = (data || [])
      .map(row => mapToAdminUser(row as AdminUserRow))
      .filter(teacher =>
        teacher.branchIds.length === 0 || teacher.branchIds.includes(branchId)
      );

    return teachers;
  } catch (error) {
    console.error('Error getting teachers for branch:', error);
    return [];
  }
}

// Get admin user by ID
export async function getAdminUser(userId: string): Promise<AdminUser | null> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    if (!data) return null;

    return mapToAdminUser(data as AdminUserRow);
  } catch (error) {
    console.error('Error getting admin user:', error);
    throw error;
  }
}

// Create new admin user (via API route)
export async function createAdminUser(
  email: string,
  password: string,
  userData: Omit<AdminUser, 'id' | 'email' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  createdBy: string,
  authToken: string
): Promise<string> {
  try {
    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        email,
        password,
        userData: {
          ...userData,
          email
        },
        createdBy
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to create user');
    }

    return result.userId;
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
}

// Update admin user
export async function updateAdminUser(
  userId: string,
  data: Partial<AdminUser>,
  updatedBy: string
): Promise<void> {
  try {
    const supabase = getClient();

    const updateData: any = {
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    };

    if (data.displayName !== undefined) updateData.display_name = data.displayName;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.branchIds !== undefined) updateData.branch_ids = data.branchIds;
    if (data.teacherId !== undefined) updateData.teacher_id = data.teacherId;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    if (data.permissions) {
      if (data.permissions.canManageUsers !== undefined) {
        updateData.can_manage_users = data.permissions.canManageUsers;
      }
      if (data.permissions.canManageSettings !== undefined) {
        updateData.can_manage_settings = data.permissions.canManageSettings;
      }
      if (data.permissions.canViewReports !== undefined) {
        updateData.can_view_reports = data.permissions.canViewReports;
      }
      if (data.permissions.canManageAllBranches !== undefined) {
        updateData.can_manage_all_branches = data.permissions.canManageAllBranches;
      }
    }

    const { error } = await supabase
      .from('admin_users')
      .update(updateData)
      .eq('id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating admin user:', error);
    throw error;
  }
}

// Send password reset email
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    const supabase = getClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error sending password reset:', error);
    throw error;
  }
}

// Check if email already exists
export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email.toLowerCase())
      .limit(1);

    if (error) throw error;

    return (data || []).length > 0;
  } catch (error) {
    console.error('Error checking email:', error);
    return false;
  }
}

// Create admin user simple (for migration or manual creation)
export async function createAdminUserSimple(
  userId: string,
  userData: {
    email: string;
    displayName: string;
    role: 'super_admin' | 'branch_admin' | 'teacher';
    branchIds: string[];
    permissions?: {
      canManageUsers?: boolean;
      canManageSettings?: boolean;
      canViewReports?: boolean;
      canManageAllBranches?: boolean;
    };
    isActive: boolean;
  },
  createdBy: string
): Promise<void> {
  try {
    const supabase = getClient();

    const { error } = await supabase
      .from('admin_users')
      .insert({
        id: userId,
        auth_user_id: null,
        email: userData.email.toLowerCase(),
        display_name: userData.displayName,
        role: userData.role,
        branch_ids: userData.branchIds,
        teacher_id: null,
        can_manage_users: userData.permissions?.canManageUsers ?? false,
        can_manage_settings: userData.permissions?.canManageSettings ?? false,
        can_view_reports: userData.permissions?.canViewReports ?? false,
        can_manage_all_branches: userData.permissions?.canManageAllBranches ?? false,
        is_active: userData.isActive,
        created_by: createdBy,
        updated_by: createdBy,
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
}

// Delete admin user (soft delete)
export async function deleteAdminUser(
  userId: string,
  deletedBy: string
): Promise<void> {
  try {
    const supabase = getClient();

    const { error } = await supabase
      .from('admin_users')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
        updated_by: deletedBy,
      })
      .eq('id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting admin user:', error);
    throw error;
  }
}
