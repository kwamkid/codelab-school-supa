'use client';

import Link from 'next/link';
import { Student } from '@/types/models';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Cake, School, Edit } from 'lucide-react';
import { formatDate, calculateAge } from '@/lib/utils';

interface StudentMiniCardProps {
  student: Student;
  /** 'full' = detail page (allergies, special needs, emergency, edit btn);
   *  'compact' = dialog/quick view (name + age + school + gender only). */
  variant?: 'full' | 'compact';
  /** When set (full variant), shows an edit button linking here. */
  editHref?: string;
}

/** Shared student card used on the parent detail page and the parent quick-view
 *  dialog so both stay in sync. */
export function StudentMiniCard({ student, variant = 'full', editHref }: StudentMiniCardProps) {
  const compact = variant === 'compact';
  const avatarSize = compact ? 'w-10 h-10' : 'w-16 h-16';
  const iconSize = compact ? 'h-5 w-5' : 'h-8 w-8';

  return (
    <div
      className={`rounded-lg p-4 border transition-colors ${
        !student.isActive
          ? 'opacity-60 bg-gray-100 border-gray-200'
          : 'bg-red-50/60 border-red-100 hover:bg-red-50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {student.profileImage ? (
            <img
              src={student.profileImage}
              alt={student.name}
              className={`${avatarSize} rounded-lg object-cover shrink-0`}
            />
          ) : (
            // No photo yet → gender-based avatar (boy = blue, girl = pink)
            <div
              className={`${avatarSize} rounded-lg flex items-center justify-center shrink-0 ${
                student.gender === 'M'
                  ? 'bg-blue-100 text-blue-500'
                  : 'bg-pink-100 text-pink-500'
              }`}
            >
              <User className={iconSize} />
            </div>
          )}
          <div className={compact ? 'min-w-0' : 'space-y-2 min-w-0'}>
            <div>
              <h4 className={compact ? 'font-semibold text-base' : 'font-semibold text-lg'}>
                {student.nickname || student.name}
              </h4>
              {!compact && <p className="text-sm text-gray-600">{student.name}</p>}
            </div>

            <div className={compact
              ? 'flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-gray-500 mt-0.5'
              : 'flex flex-col gap-1.5 text-sm text-gray-600'}>
              <span className="flex items-center gap-1.5">
                <Cake className={compact ? 'h-3 w-3' : 'h-4 w-4 text-gray-400 shrink-0'} />
                {compact
                  ? `${calculateAge(student.birthdate)} ปี`
                  : `${formatDate(student.birthdate)} (${calculateAge(student.birthdate)} ปี)`}
              </span>
              {student.schoolName && (
                <span className="flex items-center gap-1.5">
                  <School className={compact ? 'h-3 w-3' : 'h-4 w-4 text-gray-400 shrink-0'} />
                  <span>
                    {student.schoolName}
                    {student.gradeLevel && <span className="text-gray-400 ml-1">({student.gradeLevel})</span>}
                  </span>
                </span>
              )}
              {compact ? (
                <span>{student.gender === 'M' ? 'ชาย' : 'หญิง'}</span>
              ) : (
                <Badge variant={student.gender === 'M' ? 'secondary' : 'default'} className="w-fit">
                  {student.gender === 'M' ? 'ชาย' : 'หญิง'}
                </Badge>
              )}
              {!student.isActive && !compact && <Badge variant="destructive">ไม่ใช้งาน</Badge>}
            </div>

            {!compact && student.allergies && (
              <div className="mt-2">
                <span className="text-sm text-red-600">⚠️ แพ้: {student.allergies}</span>
              </div>
            )}
            {!compact && student.specialNeeds && (
              <div className="mt-1">
                <span className="text-sm text-orange-600">📋 ความต้องการพิเศษ: {student.specialNeeds}</span>
              </div>
            )}
          </div>
        </div>

        {!compact && editHref && (
          <Link href={editHref}>
            <Button variant="ghost" size="sm">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      {!compact && (student.emergencyContact || student.emergencyPhone) && (
        <div className="mt-3 pt-3 border-t text-sm">
          <p className="text-gray-500 mb-1">ติดต่อฉุกเฉิน</p>
          <p>
            {student.emergencyContact}
            {student.emergencyPhone && ` - ${student.emergencyPhone}`}
          </p>
        </div>
      )}
    </div>
  );
}
