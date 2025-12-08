// contexts/BranchContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface BranchContextType {
  selectedBranchId: string | null;
  setSelectedBranchId: (branchId: string | null) => void;
  isAllBranches: boolean;
  canViewBranch: (branchId: string) => boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { adminUser, isSuperAdmin, canAccessBranch } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(() => {
    // Load from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('selectedBranchId');
      // Clear if it's an old Firebase ID (not UUID format)
      if (stored && !stored.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        localStorage.removeItem('selectedBranchId');
        return null;
      }
      return stored;
    }
    return null;
  });

  // Save to localStorage when changed
  useEffect(() => {
    if (selectedBranchId) {
      localStorage.setItem('selectedBranchId', selectedBranchId);
    } else {
      localStorage.removeItem('selectedBranchId');
    }
  }, [selectedBranchId]);

  // Validate selected branch when user changes
  useEffect(() => {
    const _isSuperAdmin = isSuperAdmin();

    if (selectedBranchId && adminUser && !_isSuperAdmin) {
      // Check if user still has access to selected branch
      const hasAccess = canAccessBranch(selectedBranchId);

      if (!hasAccess) {
        // Reset to first available branch
        if (adminUser.branchIds && adminUser.branchIds.length > 0) {
          setSelectedBranchId(adminUser.branchIds[0]);
        } else {
          setSelectedBranchId(null);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminUser?.id, selectedBranchId]);

  const canViewBranch = (branchId: string): boolean => {
    // If viewing all branches (super admin only)
    if (!selectedBranchId) {
      return isSuperAdmin();
    }
    
    // If specific branch selected, must match and have access
    return selectedBranchId === branchId && canAccessBranch(branchId);
  };

  const value: BranchContextType = {
    selectedBranchId,
    setSelectedBranchId,
    isAllBranches: !selectedBranchId && isSuperAdmin(),
    canViewBranch
  };

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}