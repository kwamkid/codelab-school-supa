'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
import { Badge } from '@/components/ui/badge';

interface BranchSelectorProps {
  value?: string | null;
  onValueChange: (value: string | null) => void;
  className?: string;
  showAllOption?: boolean;
}

export function BranchSelector({ 
  value, 
  onValueChange, 
  className,
  showAllOption = true 
}: BranchSelectorProps) {
  const { adminUser, canAccessBranch, isSuperAdmin } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBranches();
  }, [adminUser]);

  const loadBranches = async () => {
    try {
      const allBranches = await getBranches();
      
      // Filter branches based on user role
      const accessibleBranches = allBranches.filter(branch => 
        canAccessBranch(branch.id)
      );
      
      setBranches(accessibleBranches);
      
      // Auto-select if only one branch and no "all" option
      if (accessibleBranches.length === 1 && !showAllOption && !value) {
        onValueChange(accessibleBranches[0].id);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-500">กำลังโหลด...</div>;
  
  if (branches.length === 0) return null;
  
  // ถ้ามีแค่สาขาเดียวและไม่แสดง option ทั้งหมด
  if (branches.length === 1 && !showAllOption) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-gray-500" />
        <span className="font-medium">{branches[0].name}</span>
      </div>
    );
  }

  const showSelector = isSuperAdmin() || branches.length > 1 || showAllOption;

  if (!showSelector) {
    const selectedBranch = branches.find(b => b.id === value);
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-gray-500" />
        <span className="font-medium">{selectedBranch?.name || 'ทุกสาขา'}</span>
      </div>
    );
  }

  return (
    <Select 
      value={value || 'all'} 
      onValueChange={(val) => onValueChange(val === 'all' ? null : val)}
    >
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {showAllOption && (isSuperAdmin() || branches.length > 1) && (
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <span>ทุกสาขา</span>
              <Badge variant="secondary" className="text-xs">
                {branches.length}
              </Badge>
            </div>
          </SelectItem>
        )}
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            <div className="flex items-center gap-2">
              <span>{branch.name}</span>
              <span className="text-xs text-gray-500">({branch.code})</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}