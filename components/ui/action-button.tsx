// components/ui/action-button.tsx
'use client';

import { Button, ButtonProps } from '@/components/ui/button';
import { usePermissions } from '@/components/auth/permission-guard';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ActionButtonProps extends ButtonProps {
  action: 'create' | 'edit' | 'delete' | 'view' | 'custom';
  requiredRole?: ('super_admin' | 'branch_admin' | 'teacher')[];
  requiredPermission?: string;
  hideWhenDisabled?: boolean;
  disabledText?: string;
  children: ReactNode;
}

/**
 * Button that automatically checks permissions based on action type
 */
export function ActionButton({
  action,
  requiredRole,
  requiredPermission,
  hideWhenDisabled = false,
  disabledText,
  children,
  className,
  ...buttonProps
}: ActionButtonProps) {
  const permissions = usePermissions();

  // Check action-based permissions
  let hasPermission = true;
  let disabledReason = '';

  switch (action) {
    case 'create':
      hasPermission = permissions.canCreate();
      disabledReason = 'คุณไม่มีสิทธิ์สร้างข้อมูล';
      break;
    case 'edit':
      hasPermission = permissions.canEdit();
      disabledReason = 'คุณไม่มีสิทธิ์แก้ไขข้อมูล';
      break;
    case 'delete':
      hasPermission = permissions.canDelete();
      disabledReason = 'คุณไม่มีสิทธิ์ลบข้อมูล';
      break;
    case 'view':
      hasPermission = true; // Everyone can view
      break;
    case 'custom':
      // Check custom requirements
      if (requiredRole) {
        hasPermission = permissions.hasRole(requiredRole);
        disabledReason = 'คุณไม่มีสิทธิ์ดำเนินการนี้';
      }
      if (requiredPermission) {
        hasPermission = hasPermission && permissions.hasPermission(requiredPermission);
        disabledReason = 'คุณไม่มีสิทธิ์ดำเนินการนี้';
      }
      break;
  }

  // Hide button if no permission and hideWhenDisabled is true
  if (!hasPermission && hideWhenDisabled) {
    return null;
  }

  // Show disabled button with custom styling
  return (
    <div className="relative inline-flex group">
      <Button
        {...buttonProps}
        disabled={!hasPermission || buttonProps.disabled}
        className={cn(
          className,
          !hasPermission && "cursor-not-allowed"
        )}
      >
        {children}
      </Button>
      
      {/* Show reason on hover when disabled */}
      {!hasPermission && (disabledText || disabledReason) && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {disabledText || disabledReason}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-gray-900" />
        </div>
      )}
    </div>
  );
}