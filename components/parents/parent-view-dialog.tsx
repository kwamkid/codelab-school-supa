'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Parent, Student, Branch } from '@/types/models';
import { getParentWithStudents } from '@/lib/services/parents';
import { getBranch } from '@/lib/services/branches';
import { ResponsiveFormDialog } from '@/components/shared/responsive-form-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ParentBadge } from '@/components/ui/parent-badge';
import { StudentMiniCard } from '@/components/students/student-mini-card';
import { Phone, Mail, MapPin, Users, Home, Edit, Loader2, Plus } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

interface ParentViewDialogProps {
  parentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Read-only quick view of a parent (info + address + students), opened from the
 *  list's eye icon. Editing happens on the full /parents/[id] page. */
export function ParentViewDialog({ parentId, open, onOpenChange }: ParentViewDialogProps) {
  const router = useRouter();
  const [parent, setParent] = useState<Parent | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !parentId) return;
    let active = true;
    setLoading(true);
    setParent(null);
    setBranch(null);
    (async () => {
      try {
        const { parent: p, students: s } = await getParentWithStudents(parentId);
        if (!active) return;
        setParent(p);
        setStudents(s);
        if (p?.preferredBranchId) {
          const b = await getBranch(p.preferredBranchId);
          if (active) setBranch(b);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open, parentId]);

  const activeStudents = students.filter((s) => s.isActive);

  return (
    <ResponsiveFormDialog open={open} onOpenChange={onOpenChange} title="ข้อมูลผู้ปกครอง">
      {loading || !parent ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            {parent.pictureUrl ? (
              <img src={parent.pictureUrl} alt={parent.displayName}
                className="w-14 h-14 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Users className="h-7 w-7 text-gray-400" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <ParentBadge name={parent.displayName} showAvatar={false} size="lg"
                  className="text-xl font-bold text-gray-900" />
                {parent.lineUserId && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-sm">LINE</Badge>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-0.5">
                ลงทะเบียน {formatDate(parent.createdAt, 'long')}
              </p>
            </div>
          </div>

          {/* Contact + address */}
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 space-y-2 text-base">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400 shrink-0" />
              <span>{parent.phone || '—'}</span>
              {parent.emergencyPhone && (
                <span className="text-gray-400">· ฉุกเฉิน {parent.emergencyPhone}</span>
              )}
            </div>
            {parent.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="break-all">{parent.email}</span>
              </div>
            )}
            {branch && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{branch.name}</span>
              </div>
            )}
            {parent.address && (
              <div className="flex items-start gap-2 pt-1">
                <Home className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                <span className="text-gray-600">
                  {parent.address.houseNumber}
                  {parent.address.street && ` ถ.${parent.address.street}`}
                  {' '}แขวง{parent.address.subDistrict} เขต{parent.address.district}{' '}
                  {parent.address.province} {parent.address.postalCode}
                </span>
              </div>
            )}
          </div>

          {/* Students */}
          <div>
            <p className="text-base font-semibold text-gray-700 mb-2">
              นักเรียน ({activeStudents.length})
            </p>
            <div className="space-y-2">
              {students.map((s) => (
                <StudentMiniCard key={s.id} student={s} variant="compact" />
              ))}
              {parent && (
                <Link href={`/parents/${parent.id}/students/new`} className="block">
                  <Button
                    variant="outline"
                    className="w-full border-dashed border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    เพิ่มนักเรียน
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
            <Button
              className="bg-red-500 hover:bg-red-600"
              onClick={() => router.push(`/parents/${parent.id}`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              แก้ไขข้อมูล
            </Button>
          </div>
        </div>
      )}
    </ResponsiveFormDialog>
  );
}
