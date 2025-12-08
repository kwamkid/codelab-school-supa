// components/layout/branch-selector.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/contexts/BranchContext';
import { getBranches } from '@/lib/services/branches';
import { Branch } from '@/types/models';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { usePathname } from 'next/navigation';

export function BranchSelector() {
  const { adminUser, isSuperAdmin, canAccessBranch } = useAuth();
  const { selectedBranchId, setSelectedBranchId } = useBranch();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  // Check if current page requires specific branch selection
  const requiresSpecificBranch = pathname.includes('/reports/availability');
  
  // Pages that should not show branch selector (global data)
  const globalDataPages = [
    '/teaching-materials',
    '/teaching/slides',
    '/subjects',
    '/users',
    '/parents',      // เพิ่ม: หน้าผู้ปกครอง
    '/students'      // เพิ่ม: หน้านักเรียน
  ];
  const isGlobalDataPage = globalDataPages.some(page => pathname.startsWith(page));
  
  useEffect(() => {
    loadBranches();
  }, [adminUser]);

  useEffect(() => {
    // Auto-select first branch if on pages that require specific branch
    if (requiresSpecificBranch && !selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [requiresSpecificBranch, selectedBranchId, branches]);

  const loadBranches = async () => {
    try {
      const allBranches = await getBranches();
      
      // Filter branches based on user role
      let availableBranches = allBranches;
      
      if (!isSuperAdmin() && adminUser?.branchIds && adminUser.branchIds.length > 0) {
        // Branch admin - show only assigned branches
        availableBranches = allBranches.filter(branch => 
          adminUser.branchIds.includes(branch.id)
        );
      }
      
      setBranches(availableBranches);
      
      // Set default branch if not selected
      if (!selectedBranchId && availableBranches.length > 0) {
        // If user has preferred branch
        if (adminUser?.branchIds && adminUser.branchIds.length === 1) {
          setSelectedBranchId(adminUser.branchIds[0]);
        } else if (requiresSpecificBranch) {
          // If on page that requires specific branch, select first
          setSelectedBranchId(availableBranches[0].id);
        } else {
          // Select first active branch for non-super admin
          if (!isSuperAdmin()) {
            const firstActive = availableBranches.find(b => b.isActive);
            if (firstActive) {
              setSelectedBranchId(firstActive.id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading branches:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show selector on global data pages
  if (isGlobalDataPage) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Building2 className="h-4 w-4" />
        <span className="font-medium">ข้อมูลส่วนกลาง</span>
        <Badge variant="secondary" className="text-xs">
          ทุกสาขา
        </Badge>
      </div>
    );
  }

  // Don't show selector if user has only one branch (for non-global pages)
  if (!isSuperAdmin() && adminUser?.branchIds && adminUser.branchIds.length === 1) {
    const branch = branches.find(b => b.id === adminUser.branchIds[0]);
    if (branch) {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Building2 className="h-4 w-4" />
          <span className="font-medium">{branch.name}</span>
        </div>
      );
    }
    return null;
  }

  // Don't show if no branches available
  if (branches.length === 0) {
    return null;
  }

  // For super admin - show "All Branches" option (except on specific pages)
  const showAllOption = isSuperAdmin() && !requiresSpecificBranch;

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-gray-500" />
      <Select 
        value={selectedBranchId || (showAllOption ? 'all' : '')} 
        onValueChange={(value) => setSelectedBranchId(value === 'all' ? null : value)}
        disabled={loading}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="เลือกสาขา" />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>ทุกสาขา</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {branches.length}
                </Badge>
              </div>
            </SelectItem>
          )}
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              <div className="flex items-center justify-between w-full">
                <span>{branch.name}</span>
                {!branch.isActive && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    ปิด
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Show tooltip for pages that require specific branch */}
      {requiresSpecificBranch && isSuperAdmin() && (
        <div className="text-xs text-amber-600 ml-2">
          <span className="inline-flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ต้องเลือกสาขาเฉพาะ
          </span>
        </div>
      )}
    </div>
  );
}