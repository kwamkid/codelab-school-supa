// components/auth/role-gate.tsx
// ด่านสิทธิ์ระดับหน้า (auth guard):
//  • <RoleGate roles={['super_admin']}>…</RoleGate> — ระหว่างรอ auth โหลดแสดง PageLoading,
//    ไม่มีสิทธิ์แสดง <AccessDenied>, มีสิทธิ์ค่อย render ลูก (ลูกจึงยิง fetch ได้เลยไม่ต้องเช็คเอง)
//  • admin layout ใช้ <AccessDenied> คู่กับ lib/auth/route-access.ts บังคับทุก path อีกชั้น
// ต่างจาก PermissionGuard (ซ่อน/โชว์ปุ่ม-ส่วนย่อยในหน้า) — ตัวนี้ใช้ห่อทั้งหน้า

'use client'

import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { EmptyState } from '@/components/ui/empty-state'
import { PageLoading } from '@/components/ui/loading'
import type { StaffRole } from '@/lib/auth/route-access'

const ROLE_LABEL: Record<StaffRole, string> = {
  super_admin: 'Super Admin',
  branch_admin: 'แอดมินสาขา',
  teacher: 'ครู',
}

export function AccessDenied({ roles }: { roles?: StaffRole[] }) {
  return (
    <div className="p-4 sm:p-6 text-base">
      <EmptyState
        icon={ShieldAlert}
        title="คุณไม่มีสิทธิ์เข้าหน้านี้"
        description={roles?.length ? `หน้านี้สำหรับ ${roles.map((r) => ROLE_LABEL[r]).join(' / ')} เท่านั้น` : undefined}
      />
    </div>
  )
}

export function RoleGate({ roles, children }: { roles: StaffRole[]; children: React.ReactNode }) {
  const { adminUser, loading } = useAuth()
  if (loading || !adminUser) return loading ? <PageLoading /> : <AccessDenied roles={roles} />
  if (!roles.includes(adminUser.role)) return <AccessDenied roles={roles} />
  return <>{children}</>
}
