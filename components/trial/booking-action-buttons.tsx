'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/components/auth/permission-guard';
import {
  PhoneCall,
  CalendarCheck,
  ClipboardCheck,
  GraduationCap,
  XCircle,
  Trash2,
} from 'lucide-react';
import { TrialBooking } from '@/types/models';

interface BookingActionButtonsProps {
  booking: TrialBooking;
  onContact: (booking: TrialBooking) => void;
  onSchedule?: (booking: TrialBooking) => void;
  onMarkAttended?: (booking: TrialBooking) => void;
  onCancel: (booking: TrialBooking) => void;
  onDelete: (booking: TrialBooking) => void;
}

// Primary action = next status color + label (only for actionable statuses)
const primaryActions: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  navigateTo?: boolean;
}> = {
  new:       { label: 'ติดต่อ',      icon: PhoneCall,      color: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
  contacted: { label: 'นัดหมาย',     icon: CalendarCheck,  color: 'bg-purple-500 hover:bg-purple-600 text-white', navigateTo: true },
  scheduled: { label: 'เรียนแล้ว',   icon: ClipboardCheck, color: 'bg-green-500 hover:bg-green-600 text-white',  navigateTo: true },
  completed: { label: 'ลงทะเบียน',   icon: GraduationCap,  color: 'bg-emerald-500 hover:bg-emerald-600 text-white', navigateTo: true },
};

export function BookingActionButtons({
  booking,
  onContact,
  onSchedule,
  onMarkAttended,
  onCancel,
  onDelete,
}: BookingActionButtonsProps) {
  const primary = primaryActions[booking.status];

  const canCancel = booking.status === 'new' || booking.status === 'contacted' || booking.status === 'scheduled';
  const canDelete = booking.status === 'new' || booking.status === 'cancelled';

  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {/* Primary action — colored by next status */}
      {primary && (
        booking.status === 'new' ? (
          <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
            <Button
              size="sm"
              className={`h-7 gap-1 text-sm px-2.5 ${primary.color}`}
              onClick={() => onContact(booking)}
            >
              <primary.icon className="h-3.5 w-3.5" />
              {primary.label}
            </Button>
          </PermissionGuard>
        ) : booking.status === 'contacted' && onSchedule ? (
          <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
            <Button
              size="sm"
              className={`h-7 gap-1 text-sm px-2.5 ${primary.color}`}
              onClick={() => onSchedule(booking)}
            >
              <primary.icon className="h-3.5 w-3.5" />
              {primary.label}
            </Button>
          </PermissionGuard>
        ) : booking.status === 'scheduled' && onMarkAttended ? (
          <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
            <Button
              size="sm"
              className={`h-7 gap-1 text-sm px-2.5 ${primary.color}`}
              onClick={() => onMarkAttended(booking)}
            >
              <primary.icon className="h-3.5 w-3.5" />
              {primary.label}
            </Button>
          </PermissionGuard>
        ) : booking.status === 'completed' ? (
          <Button
            size="sm"
            className={`h-7 gap-1 text-sm px-2.5 ${primary.color}`}
            asChild
          >
            <Link href={`/enrollments/new?from=trial&bookingId=${booking.id}`}>
              <primary.icon className="h-3.5 w-3.5" />
              {primary.label}
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            className={`h-7 gap-1 text-sm px-2.5 ${primary.color}`}
            asChild
          >
            <Link href={`/trial/${booking.id}`}>
              <primary.icon className="h-3.5 w-3.5" />
              {primary.label}
            </Link>
          </Button>
        )
      )}

      {/* Cancel button — ghost, no border */}
      <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
        {canCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(booking)}
            className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        )}
      </PermissionGuard>

      {/* Delete button */}
      <PermissionGuard requiredRole={['super_admin', 'branch_admin']}>
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(booking)}
            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </PermissionGuard>
    </div>
  );
}
