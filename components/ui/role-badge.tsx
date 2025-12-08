// components/ui/role-badge.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Shield, Building2, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoleBadgeProps {
  role: 'super_admin' | 'branch_admin' | 'teacher';
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RoleBadge({ 
  role, 
  showIcon = true, 
  size = 'md',
  className 
}: RoleBadgeProps) {
  const roleConfig = {
    super_admin: {
      label: 'Super Admin',
      icon: Shield,
      variant: 'destructive' as const,
      color: 'text-red-600 bg-red-50 border-red-200'
    },
    branch_admin: {
      label: 'Branch Admin',
      icon: Building2,
      variant: 'default' as const,
      color: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    teacher: {
      label: 'Teacher',
      icon: UserCog,
      variant: 'secondary' as const,
      color: 'text-gray-600 bg-gray-50 border-gray-200'
    }
  };

  const config = roleConfig[role];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4'
  };

  return (
    <Badge 
      variant={config.variant}
      className={cn(
        sizeClasses[size],
        config.color,
        'font-medium border',
        className
      )}
    >
      {showIcon && <Icon className={cn(iconSizes[size], 'mr-1')} />}
      {config.label}
    </Badge>
  );
}