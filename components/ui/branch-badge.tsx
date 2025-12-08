// components/ui/branch-badge.tsx
'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Building2 } from 'lucide-react';
import { getBranch } from '@/lib/services/branches';
import { Branch } from '@/types/models';
import { cn } from '@/lib/utils';

interface BranchBadgeProps {
  branchId: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function BranchBadge({ 
  branchId, 
  showIcon = false, 
  size = 'md',
  className 
}: BranchBadgeProps) {
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBranch();
  }, [branchId]);

  const loadBranch = async () => {
    try {
      const data = await getBranch(branchId);
      setBranch(data);
    } catch (error) {
      console.error('Error loading branch:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Badge variant="secondary" className={cn("animate-pulse", className)}>
        <span className="opacity-50">...</span>
      </Badge>
    );
  }

  if (!branch) {
    return (
      <Badge variant="secondary" className={className}>
        ไม่ระบุสาขา
      </Badge>
    );
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1'
  };

  return (
    <Badge 
      variant={branch.isActive ? "default" : "secondary"}
      className={cn(
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Building2 className="h-3 w-3 mr-1" />}
      {branch.name}
    </Badge>
  );
}