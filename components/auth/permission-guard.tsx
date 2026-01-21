// components/auth/permission-guard.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/contexts/BranchContext';
import { ReactNode } from 'react';

interface PermissionGuardProps {
  children: ReactNode;
  requiredRole?: ('super_admin' | 'branch_admin' | 'teacher')[];
  requiredPermission?: string;
  requireAllBranches?: boolean;
  fallback?: ReactNode;
  showError?: boolean;
}

/**
 * Component to conditionally render children based on user permissions
 */
export function PermissionGuard({
  children,
  requiredRole,
  requiredPermission,
  requireAllBranches,
  fallback = null,
  showError = false
}: PermissionGuardProps) {
  const { adminUser, isSuperAdmin, loading } = useAuth();
  const { isAllBranches } = useBranch();

  // Wait for auth to load before checking permissions
  if (loading) {
    return <>{children}</>; // Show children while loading (will be handled by ActionButton)
  }

  // Check if user has required role
  if (requiredRole && adminUser) {
    if (!requiredRole.includes(adminUser.role)) {
      return showError ? (
        <div className="text-center py-8 text-gray-500">
          คุณไม่มีสิทธิ์เข้าถึงส่วนนี้
        </div>
      ) : (
        <>{fallback}</>
      );
    }
  }

  // Check if user has specific permission
  if (requiredPermission) {
    // Super admin has all permissions
    if (!isSuperAdmin()) {
      const hasPermission = adminUser?.permissions?.[requiredPermission];
      if (!hasPermission) {
        return showError ? (
          <div className="text-center py-8 text-gray-500">
            คุณไม่มีสิทธิ์ {requiredPermission}
          </div>
        ) : (
          <>{fallback}</>
        );
      }
    }
  }

  // Check if requires all branches view
  if (requireAllBranches && !isAllBranches) {
    return showError ? (
      <div className="text-center py-8 text-gray-500">
        ฟีเจอร์นี้ใช้ได้เฉพาะเมื่อดูข้อมูลทุกสาขา
      </div>
    ) : (
      <>{fallback}</>
    );
  }

  return <>{children}</>;
}

/**
 * Hook to check permissions
 */
export function usePermissions() {
  const { adminUser, isSuperAdmin, loading } = useAuth();
  const { isAllBranches } = useBranch();

  const hasRole = (roles: ('super_admin' | 'branch_admin' | 'teacher')[]): boolean => {
    if (loading) return true; // Allow while loading
    if (!adminUser) return false;
    return roles.includes(adminUser.role);
  };

  const hasPermission = (permission: string): boolean => {
    if (loading) return true; // Allow while loading
    if (isSuperAdmin()) return true;
    return adminUser?.permissions?.[permission] || false;
  };

  const canEdit = (): boolean => {
    if (loading) return true; // Allow while loading
    // Super admin and branch admin can edit
    return hasRole(['super_admin', 'branch_admin']);
  };

  const canDelete = (): boolean => {
    if (loading) return true; // Allow while loading
    // Only super admin and branch admin can delete
    return hasRole(['super_admin', 'branch_admin']);
  };

  const canCreate = (): boolean => {
    if (loading) return true; // Allow while loading
    // Super admin and branch admin can create
    return hasRole(['super_admin', 'branch_admin']);
  };

  const canManageFinance = (): boolean => {
    return hasPermission('canManageFinance') || isSuperAdmin();
  };

  const canViewReports = (): boolean => {
    return hasPermission('canViewReports') || hasRole(['super_admin', 'branch_admin']);
  };

  return {
    hasRole,
    hasPermission,
    canEdit,
    canDelete,
    canCreate,
    canManageFinance,
    canViewReports,
    isAllBranches,
    isSuperAdmin: isSuperAdmin(),
    isBranchAdmin: adminUser?.role === 'branch_admin',
    isTeacher: adminUser?.role === 'teacher',
    userRole: adminUser?.role,
    loading
  };
}