'use client'

// สถิติการใช้งาน (super_admin เท่านั้น — เมนูกลุ่ม "ผู้บริหาร") — เมนูไหนถูกเปิดบ่อยแค่ไหน โดยใคร
// ใช้ตัดสินใจว่าเมนู/รายงานไหนควรเก็บ ย้าย หรือตัดทิ้ง
// ข้อมูลจาก admin_page_views (admin layout log ทุกการเปิดหน้า) → RPC get_menu_usage

import { useState } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import { useAdminJson } from '@/hooks/useAdminJson'
import { RoleGate } from '@/components/auth/role-gate'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { FormSelect } from '@/components/ui/form-select'
import { ChartCard } from '@/components/ui/chart-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { PageLoading } from '@/components/ui/loading'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

interface MenuRow {
  /** sidebar href (stable grouping key) */
  key: string
  menu: string
  views: number
  users: number
  daysUsed: number
  lastAt: string
  bySuper: number
  byBranch: number
  byTeacher: number
}
interface UserRow { id: string | null; name: string | null; role: string | null; views: number; menus: number; lastAt: string }
interface UsageData { since: string | null; days: number; totalViews: number; menus: MenuRow[]; users: UserRow[] }

const DAY_OPTIONS = [
  { value: '7', label: '7 วันล่าสุด' },
  { value: '30', label: '30 วันล่าสุด' },
  { value: '90', label: '90 วันล่าสุด' },
]

const ROLE_LABEL: Record<string, string> = { super_admin: 'Super Admin', branch_admin: 'แอดมินสาขา', teacher: 'ครู' }


function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(1, mins)} นาทีก่อน`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} ชม.ก่อน`
  return `${Math.round(hrs / 24)} วันก่อน`
}

export default function UsagePage() {
  return (
    <RoleGate roles={['super_admin']}>
      <Usage />
    </RoleGate>
  )
}

function Usage() {
  const [days, setDays] = useState('30')
  const { data, loading, reload: load } = useAdminJson<UsageData>(`/api/admin/reports/usage?days=${days}`, 'โหลดสถิติไม่สำเร็จ')

  if (loading && !data) return <PageLoading />

  const maxViews = Math.max(1, ...(data?.menus ?? []).map((m) => m.views))
  const sinceText = data?.since
    ? new Date(data.since).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
    : null

  return (
    <div className="p-4 sm:p-6 text-base min-w-0">
      <PageHeader
        title="สถิติการใช้งาน"
        icon={Activity}
        iconColor="text-teal-600"
        description="เมนูไหนถูกเปิดบ่อยแค่ไหน โดยใคร — ใช้ตัดสินใจว่าเมนูไหนควรเก็บหรือตัด"
        action={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> รีเฟรช
          </Button>
        }
      />

      <div className="space-y-6 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <FormSelect value={days} onValueChange={setDays} options={DAY_OPTIONS} className="w-[200px]" />
          <span className="text-gray-500">
            {sinceText ? `เริ่มเก็บสถิติ ${sinceText}` : 'เพิ่งเริ่มเก็บสถิติ'} · เปิดหน้าทั้งหมด {formatNumber(data?.totalViews ?? 0)} ครั้ง
          </span>
        </div>

        <ChartCard
          title="การใช้งานแต่ละเมนู"
          description="นับทุกครั้งที่เปิดหน้า (เปิดหน้าเดิมซ้ำภายใน 30 วินาทีไม่นับ) · หน้าย่อย เช่น รายละเอียดนักเรียน นับรวมกับเมนูหลัก · เมนูที่ไม่มีในตาราง = ไม่มีใครเปิดเลยในช่วงนี้"
          contentClassName="overflow-x-auto"
        >
            {!data?.menus.length ? (
              <EmptyState icon={Activity} title="ยังไม่มีข้อมูล" description="ระบบเพิ่งเริ่มเก็บสถิติ ลองกลับมาดูอีก 1–2 สัปดาห์" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">เมนู</TableHead>
                    <TableHead className="min-w-[200px]">เปิดหน้า (ครั้ง)</TableHead>
                    <TableHead className="text-right">คนใช้</TableHead>
                    <TableHead className="text-right">วันที่ใช้</TableHead>
                    <TableHead className="text-right">Super Admin</TableHead>
                    <TableHead className="text-right">แอดมินสาขา</TableHead>
                    <TableHead className="text-right">ครู</TableHead>
                    <TableHead className="text-right">ล่าสุด</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.menus.map((m) => (
                    <TableRow key={m.key}>
                      <TableCell className="font-medium">{m.menu}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 num">
                          <div className="h-2 rounded-full bg-teal-500" style={{ width: `${Math.max(3, (m.views / maxViews) * 120)}px` }} />
                          {formatNumber(m.views)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right num">{m.users}</TableCell>
                      <TableCell className="text-right num">{m.daysUsed}</TableCell>
                      <TableCell className="text-right num">{m.bySuper || '–'}</TableCell>
                      <TableCell className="text-right num">{m.byBranch || '–'}</TableCell>
                      <TableCell className="text-right num">{m.byTeacher || '–'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap text-gray-500">{ago(m.lastAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </ChartCard>

        <ChartCard title="การใช้งานรายคน" contentClassName="overflow-x-auto">
            {!data?.users.length ? (
              <EmptyState icon={Activity} title="ยังไม่มีข้อมูล" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>บทบาท</TableHead>
                    <TableHead className="text-right">เปิดหน้า (ครั้ง)</TableHead>
                    <TableHead className="text-right">จำนวนเมนูที่ใช้</TableHead>
                    <TableHead className="text-right">ล่าสุด</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => (
                    <TableRow key={u.id ?? 'unknown'}>
                      <TableCell className="font-medium">{u.name || 'ไม่ทราบชื่อ'}</TableCell>
                      <TableCell>{(u.role && ROLE_LABEL[u.role]) || u.role || '—'}</TableCell>
                      <TableCell className="text-right num">{formatNumber(u.views)}</TableCell>
                      <TableCell className="text-right num">{u.menus}</TableCell>
                      <TableCell className="text-right whitespace-nowrap text-gray-500">{ago(u.lastAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </ChartCard>
      </div>
    </div>
  )
}
