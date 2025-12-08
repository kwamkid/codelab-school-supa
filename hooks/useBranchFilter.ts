// hooks/useBranchFilter.ts
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook for filtering data based on selected branch
 */
export function useBranchFilter() {
  const { selectedBranchId, isAllBranches } = useBranch();
  const { adminUser, isSuperAdmin, canAccessBranch } = useAuth();

  /**
   * Filter array of items that have branchId property
   */
  function filterByBranch<T extends { branchId: string }>(items: T[]): T[] {
    if (isAllBranches) {
      // Super admin viewing all branches
      return items;
    }

    if (selectedBranchId) {
      // Filter by selected branch
      return items.filter(item => item.branchId === selectedBranchId);
    }

    // Branch admin with multiple branches but none selected
    if (adminUser?.branchIds && adminUser.branchIds.length > 0) {
      return items.filter(item => adminUser.branchIds.includes(item.branchId));
    }

    // No access
    return [];
  }

  /**
   * Check if user can view specific branch data
   */
  function canViewBranchData(branchId: string): boolean {
    if (isAllBranches) return true;
    if (selectedBranchId) return selectedBranchId === branchId;
    return canAccessBranch(branchId);
  }

  /**
   * Get branch query parameters for Firestore
   */
  function getBranchQuery() {
    if (isAllBranches) {
      return null; // No filter needed
    }

    if (selectedBranchId) {
      return { field: 'branchId', value: selectedBranchId };
    }

    // Multiple branches for branch admin
    if (adminUser?.branchIds && adminUser.branchIds.length > 0) {
      return { field: 'branchId', values: adminUser.branchIds };
    }

    return { field: 'branchId', value: 'none' }; // Will return no results
  }

  /**
   * Get display text for current branch selection
   */
  function getBranchDisplay(): string {
    if (isAllBranches) return 'ทุกสาขา';
    if (selectedBranchId) return ''; // Will be shown by BranchSelector
    return 'กรุณาเลือกสาขา';
  }

  return {
    selectedBranchId,
    isAllBranches,
    filterByBranch,
    canViewBranchData,
    getBranchQuery,
    getBranchDisplay,
  };
}