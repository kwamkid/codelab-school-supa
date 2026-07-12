'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FormSelect } from '@/components/ui/form-select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Loader2, Copy, Check, LinkIcon } from 'lucide-react';
import { Branch, Subject } from '@/types/models';
import { createInvitation } from '@/lib/services/invitations';
import { getActiveSubjects } from '@/lib/services/subjects';
import { toast } from 'sonner';

type Role = 'super_admin' | 'branch_admin' | 'teacher';

const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin',
  branch_admin: 'Branch Admin',
  teacher: 'ครูผู้สอน (Teacher)',
};

interface CreateInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  onSuccess?: () => void;
  /** Role chosen from the "add member" dropdown; preselects + locks the role. */
  initialRole?: Role;
}

// Invite links are valid for 24 hours only.
const EXPIRES_IN_DAYS = 1;

export default function CreateInviteDialog({
  open,
  onOpenChange,
  branches,
  onSuccess,
  initialRole,
}: CreateInviteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // form state — permissions only; the invitee fills in their own name/nickname/phone
  const [role, setRole] = useState<Role>('branch_admin');
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState({
    canManageAllBranches: false,
    canManageSettings: false,
    canViewReports: false,
  });
  // Subjects the teacher will teach (teacher role only) → teachers.specialties.
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);

  const resetForm = () => {
    setRole(initialRole || 'branch_admin');
    setBranchIds([]);
    setPermissions({ canManageAllBranches: false, canManageSettings: false, canViewReports: false });
    setSubjectIds([]);
    setCreatedUrl(null);
    setCopied(false);
  };

  // Reset whenever the dialog is (re)opened or the chosen role changes
  useEffect(() => {
    if (open) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRole]);

  // Load subjects once (used only when inviting a teacher)
  useEffect(() => {
    if (!open) return;
    getActiveSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, [open]);

  const subjectsByCategory = subjects.reduce((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {} as Record<string, Subject[]>);

  const toggleSubject = (id: string, checked: boolean) => {
    setSubjectIds((prev) => (checked ? [...prev, id] : prev.filter((s) => s !== id)));
  };

  const allBranches = branchIds.length === 0;
  const showBranchPicker = role !== 'super_admin' && !permissions.canManageAllBranches;

  const handleSubmit = async () => {
    if (role === 'teacher' && subjectIds.length === 0) {
      toast.error('กรุณาเลือกวิชาที่สอนอย่างน้อย 1 วิชา');
      return;
    }
    try {
      setLoading(true);
      const { invitation } = await createInvitation({
        role,
        branchIds: role === 'super_admin' ? [] : branchIds,
        permissions: role === 'branch_admin' ? permissions : undefined,
        subjectIds: role === 'teacher' ? subjectIds : undefined,
        expiresInDays: EXPIRES_IN_DAYS,
      });
      // Build the link from the current origin so it works in both local and prod
      setCreatedUrl(`${window.location.origin}/invite/${invitation.token}`);
      onSuccess?.();
    } catch (err: any) {
      console.error('Create invite error:', err);
      toast.error(err.message || 'เกิดข้อผิดพลาดในการสร้างลิงก์เชิญ');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      toast.success('คัดลอกลิงก์แล้ว');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('ไม่สามารถคัดลอกได้');
    }
  };

  const toggleBranch = (id: string, checked: boolean) => {
    setBranchIds((prev) => (checked ? [...prev, id] : prev.filter((b) => b !== id)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{createdUrl ? 'สร้างลิงก์เชิญสำเร็จ' : 'สร้างลิงก์เชิญใหม่'}</DialogTitle>
          <DialogDescription>
            {createdUrl
              ? 'คัดลอกลิงก์ด้านล่างแล้วส่งให้ผู้ใช้งานผ่าน LINE หรืออีเมล'
              : 'ผู้รับลิงก์จะเข้าสู่ระบบด้วย Google แล้วกรอกชื่อ-ข้อมูลของตัวเอง ระบบจะสร้างบัญชีให้อัตโนมัติ'}
          </DialogDescription>
        </DialogHeader>

        {createdUrl ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                <LinkIcon className="h-4 w-4" />
                ลิงก์เชิญ ({ROLE_LABEL[role]} · ใช้ได้ 24 ชม.)
              </div>
              <div className="flex gap-2">
                <Input readOnly value={createdUrl} className="text-sm bg-white" />
                <Button type="button" onClick={handleCopy} className="shrink-0 bg-red-500 hover:bg-red-600">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                ใครก็ตามที่มีลิงก์นี้สามารถใช้สมัครได้ (ใช้ได้ครั้งเดียว) — ส่งให้เฉพาะคนที่ต้องการเท่านั้น
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                ปิด
              </Button>
              <Button type="button" onClick={resetForm} className="bg-red-500 hover:bg-red-600">
                สร้างลิงก์อีกอัน
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Role — chosen from the add-member dropdown; shown here, or selectable as fallback */}
            {initialRole ? (
              <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm">
                <span className="text-gray-500">กำลังสร้างลิงก์เชิญสำหรับ: </span>
                <span className="font-semibold text-gray-900">{ROLE_LABEL[role]}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>บทบาท</Label>
                <FormSelect
                  value={role}
                  onValueChange={(v) => setRole(v as Role)}
                  options={[
                    { value: 'super_admin', label: 'Super Admin' },
                    { value: 'branch_admin', label: 'Branch Admin' },
                    { value: 'teacher', label: 'ครูผู้สอน (Teacher)' },
                  ]}
                />
              </div>
            )}

            {/* Branch admin permissions */}
            {role === 'branch_admin' && (
              <div className="space-y-3">
                <Label>สิทธิ์พิเศษ</Label>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm">จัดการทุกสาขา</span>
                  <Switch
                    checked={permissions.canManageAllBranches}
                    onCheckedChange={(v) => setPermissions((p) => ({ ...p, canManageAllBranches: v }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm">จัดการตั้งค่า</span>
                  <Switch
                    checked={permissions.canManageSettings}
                    onCheckedChange={(v) => setPermissions((p) => ({ ...p, canManageSettings: v }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm">ดูรายงาน</span>
                  <Switch
                    checked={permissions.canViewReports}
                    onCheckedChange={(v) => setPermissions((p) => ({ ...p, canViewReports: v }))}
                  />
                </div>
              </div>
            )}

            {/* Branch picker */}
            {showBranchPicker && (
              <div className="space-y-2">
                <Label>{role === 'teacher' ? 'สาขาที่สอน' : 'สาขาที่ดูแล'}</Label>
                <div className="space-y-2 max-h-[180px] overflow-y-auto border rounded-md p-3">
                  <div className="flex items-center space-x-2 pb-2 border-b">
                    <Checkbox
                      checked={allBranches}
                      onCheckedChange={(checked) => {
                        if (checked) setBranchIds([]);
                        else if (branches.length > 0) setBranchIds([branches[0].id]);
                      }}
                    />
                    <span className="text-sm font-medium">ทุกสาขา</span>
                  </div>
                  {branches.map((branch) => (
                    <div key={branch.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={branchIds.includes(branch.id)}
                        onCheckedChange={(checked) => toggleBranch(branch.id, !!checked)}
                        disabled={allBranches}
                      />
                      <span className="text-sm">{branch.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subjects the teacher will teach → teachers.specialties */}
            {role === 'teacher' && (
              <div className="space-y-2">
                <Label>วิชาที่สอน *</Label>
                <div className="space-y-3 max-h-[220px] overflow-y-auto border rounded-md p-3">
                  {subjects.length === 0 ? (
                    <p className="text-sm text-gray-400">กำลังโหลดวิชา...</p>
                  ) : (
                    Object.entries(subjectsByCategory).map(([category, categorySubjects]) => (
                      <div key={category} className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-500">{category}</p>
                        {categorySubjects.map((subject) => (
                          <div key={subject.id} className="flex items-center space-x-2">
                            <Checkbox
                              checked={subjectIds.includes(subject.id)}
                              onCheckedChange={(checked) => toggleSubject(subject.id, !!checked)}
                            />
                            <span className="text-sm">{subject.name}</span>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500">ลิงก์มีอายุ 24 ชั่วโมง · ใช้ได้ครั้งเดียว</p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                ยกเลิก
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={loading} className="bg-red-500 hover:bg-red-600">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                สร้างลิงก์เชิญ
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
