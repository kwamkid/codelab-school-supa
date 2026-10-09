'use client'

// ยอดที่ยังไม่ได้ลง (super_admin เท่านั้น) — การลงทะเบียนที่เงินยังบันทึกไม่ครบ
//  • "ยังไม่ได้ลงยอด" = สถานะชำระแล้ว (มีวันที่จ่าย/วิธีจ่าย) แต่ยอดรับน้อยกว่าราคาคอร์ส —
//    ส่วนใหญ่เป็นข้อมูลก่อนมีระบบบันทึกรับเงิน (payment_transactions)
//  • "ค้างชำระ" = ยังจ่ายไม่ครบจริง
// แสดงว่าลงทะเบียน/จ่ายเมื่อไหร่ คอร์สไหน เรียนไปกี่ครั้งแล้ว จบเมื่อไหร่ — คลิกแถวเพื่อไปแก้ที่หน้าการลงทะเบียน
// ข้อมูลจาก RPC get_payment_gaps ผ่าน /api/admin/reports/payment-gaps

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileWarning, RefreshCw } from 'lucide-react'
import { useAdminJson } from '@/hooks/useAdminJson'
import { RoleGate } from '@/components/auth/role-gate'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { FormSelect } from '@/components/ui/form-select'
import { SearchInput } from '@/components/ui/search-input'
import { StatusFilterTabs } from '@/components/ui/status-filter-tabs'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { SortableTableHead, useSortableTable } from '@/components/ui/sortable-table-head'
import { EmptyState } from '@/components/ui/empty-state'
import { PageLoading } from '@/components/ui/loading'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Pill } from '@/components/ui/pill'
import { bangkokToday, formatBaht, thaiDateLabel, thaiMonthLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

interface GapRow {
  id: string
  kind: 'unrecorded' | 'unpaid'
  paymentStatus: string
  enrollmentStatus: string
  studentName: string
  studentNickname: string | null
  parentName: string | null
  parentPhone: string | null
  branchId: string
  branchName: string
  classId: string
  classCode: string
  subject: string
  classStatus: string
  enrolledAt: string
  paidDate: string | null
  paymentMethod: string | null
  finalPrice: number
  paidAmount: number
  gap: number
  transactions: number
  classStart: string | null
  classEnd: string | null
  sessionsTotal: number
  sessionsDone: number
  attended: number
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'เงินสด', transfer: 'โอน', bank_transfer: 'โอน', credit: 'บัตรเครดิต', credit_card: 'บัตรเครดิต', promptpay: 'พร้อมเพย์',
}

function ProgressCell({ row, today }: { row: GapRow; today: string }) {
  const total = row.sessionsTotal || 0
  const done = Math.min(row.sessionsDone, total || row.sessionsDone)
  const finished = !!row.classEnd && row.classEnd < today
  const p = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="min-w-[140px]">
      <div className="flex items-center gap-2">
        <span className="num font-medium">{done}/{total || '?'} ครั้ง</span>
        <Pill tone={finished ? 'gray' : done === 0 ? 'blue' : 'emerald'}>
          {finished ? 'จบแล้ว' : done === 0 ? 'ยังไม่เริ่ม' : 'กำลังเรียน'}
        </Pill>
      </div>
      <div className="h-1.5 mt-1 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${p}%` }} />
      </div>
      <div className="text-gray-500 mt-0.5">เด็กมาเรียน {row.attended} ครั้ง</div>
    </div>
  )
}

export default function PaymentGapsPage() {
  return (
    <RoleGate roles={['super_admin']}>
      <PaymentGaps />
    </RoleGate>
  )
}

function PaymentGaps() {
  const router = useRouter()
  const { data, loading, reload } = useAdminJson<{ rows: GapRow[] }>('/api/admin/reports/payment-gaps')
  const rows = useMemo(() => data?.rows ?? [], [data])
  const [tab, setTab] = useState<'unrecorded' | 'unpaid' | 'all'>('unrecorded')
  const [branch, setBranch] = useState('all')
  const [search, setSearch] = useState('')
  const { sort, toggle: toggleSort, sortRows } = useSortableTable()

  // วันนี้ตามเวลาไทย (ตรงกับ sessionsDone ที่ server นับ) — ไม่ใช้เวลาเครื่องผู้ใช้
  const today = useMemo(() => bangkokToday(), [])

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach((r) => map.set(r.branchId, r.branchName))
    return [{ value: 'all', label: 'ทุกสาขา' }, ...Array.from(map, ([value, label]) => ({ value, label }))]
  }, [rows])

  // กรองสาขา + ค้นหาก่อน แล้วค่อยนับแต่ละแท็บ
  const base = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (branch !== 'all' && r.branchId !== branch) return false
      if (!q) return true
      return [r.studentName, r.studentNickname, r.parentName, r.parentPhone, r.subject, r.classCode]
        .some((v) => v && v.toLowerCase().includes(q))
    })
  }, [rows, branch, search])

  const stat = (kind: GapRow['kind'] | 'all') => {
    const list = kind === 'all' ? base : base.filter((r) => r.kind === kind)
    return { count: list.length, sum: list.reduce((a, r) => a + Number(r.gap), 0) }
  }
  const sUnrec = stat('unrecorded'), sUnpaid = stat('unpaid'), sAll = stat('all')

  const list = useMemo(() => {
    const filtered = tab === 'all' ? base : base.filter((r) => r.kind === tab)
    return sortRows(filtered, (r, key) => {
      switch (key) {
        case 'student': return r.studentNickname || r.studentName
        case 'branch': return r.branchName
        case 'subject': return r.subject
        case 'enrolled': return r.enrolledAt
        case 'paid': return r.paidDate ?? ''
        case 'gap': return Number(r.gap)
        case 'progress': return r.sessionsTotal ? r.sessionsDone / r.sessionsTotal : 0
        case 'end': return r.classEnd ?? ''
        default: return ''
      }
    })
  }, [base, tab, sortRows])

  // สรุปตามเดือนที่ลงทะเบียน (ของแท็บที่เลือก)
  const byMonth = useMemo(() => {
    const map = new Map<string, { count: number; sum: number }>()
    for (const r of list) {
      const m = r.enrolledAt.slice(0, 7)
      const x = map.get(m) ?? { count: 0, sum: 0 }
      x.count += 1
      x.sum += Number(r.gap)
      map.set(m, x)
    }
    return Array.from(map, ([m, v]) => ({ m, ...v })).sort((a, b) => b.m.localeCompare(a.m))
  }, [list])

  if (loading && !data) return <PageLoading />

  return (
    <div className="p-4 sm:p-6 text-base relative min-w-0">
      <LoadingOverlay show={loading && !!data} />
      <PageHeader
        title="ยอดที่ยังไม่ได้ลง"
        backHref="/reports/business"
        icon={FileWarning}
        iconColor="text-orange-500"
        description="การลงทะเบียนที่ยอดเงินในระบบยังไม่ครบราคาคอร์ส · คลิกแถวเพื่อไปแก้ที่หน้าการลงทะเบียน"
        action={
          <Button variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> รีเฟรช
          </Button>
        }
      />

      <div className="space-y-5 min-w-0">
        <StatusFilterTabs
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          tabs={[
            {
              value: 'unrecorded', label: 'ยังไม่ได้ลงยอด', count: sUnrec.count, always: true,
              subtitle: formatBaht(sUnrec.sum),
              activeBg: 'bg-orange-500', inactiveBg: 'bg-orange-50', inactiveLabel: 'text-orange-600', inactiveCount: 'text-orange-700',
            },
            {
              value: 'unpaid', label: 'ค้างชำระ', count: sUnpaid.count, always: true,
              subtitle: formatBaht(sUnpaid.sum),
              activeBg: 'bg-red-500', inactiveBg: 'bg-red-50', inactiveLabel: 'text-red-600', inactiveCount: 'text-red-700',
            },
            {
              value: 'all', label: 'ทั้งหมด', count: sAll.count, always: true, separatorBefore: true,
              subtitle: formatBaht(sAll.sum),
              activeBg: 'bg-indigo-500', inactiveBg: 'bg-indigo-50', inactiveLabel: 'text-indigo-600', inactiveCount: 'text-indigo-700',
            },
          ]}
        />

        {tab === 'unrecorded' && (
          <p className="text-gray-600 max-w-4xl">
            รายการเหล่านี้ติดสถานะ <b>ชำระแล้ว</b> มีวันที่จ่ายและวิธีจ่าย แต่ยอดรับในระบบน้อยกว่าราคาคอร์ส (ส่วนใหญ่เป็น 0 และไม่มีรายการรับเงิน)
            มักเป็นข้อมูลสมัยก่อนมีระบบบันทึกรับเงิน — ถ้าลูกค้าจ่ายครบจริง ให้เพิ่มรายการรับเงินในหน้าการลงทะเบียน ถ้ายังไม่ได้จ่าย ให้เปลี่ยนเป็นค้างชำระ
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <FormSelect value={branch} onValueChange={setBranch} options={branchOptions} className="w-[200px]" />
          <SearchInput value={search} onChange={setSearch} placeholder="ค้นหาชื่อนักเรียน ผู้ปกครอง เบอร์ หรือคอร์ส" className="w-full sm:w-[360px]" />
        </div>

        {byMonth.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {byMonth.map((x) => (
              <span key={x.m} className="num rounded-lg bg-gray-100 px-3 py-1.5">
                ลงทะเบียน {thaiMonthLabel(x.m)}: <b>{x.count}</b> รายการ · {formatBaht(x.sum)}
              </span>
            ))}
          </div>
        )}

        {list.length === 0 ? (
          <EmptyState icon={FileWarning} title="ไม่มีรายการ" description="ยอดเงินของทุกการลงทะเบียนในกลุ่มนี้ครบแล้ว" />
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead sortKey="student" currentSort={sort} onSort={toggleSort} className="min-w-[180px] text-base">นักเรียน</SortableTableHead>
                  <SortableTableHead sortKey="branch" currentSort={sort} onSort={toggleSort} className="text-base">สาขา</SortableTableHead>
                  <SortableTableHead sortKey="subject" currentSort={sort} onSort={toggleSort} className="min-w-[180px] text-base">คอร์ส</SortableTableHead>
                  <SortableTableHead sortKey="enrolled" currentSort={sort} onSort={toggleSort} className="text-base whitespace-nowrap">ลงทะเบียน</SortableTableHead>
                  <SortableTableHead sortKey="paid" currentSort={sort} onSort={toggleSort} className="text-base whitespace-nowrap">วันที่จ่าย</SortableTableHead>
                  <SortableTableHead sortKey="gap" currentSort={sort} onSort={toggleSort} className="text-base min-w-[150px]">ยอด</SortableTableHead>
                  <SortableTableHead sortKey="progress" currentSort={sort} onSort={toggleSort} className="text-base">เรียนไปแล้ว</SortableTableHead>
                  <SortableTableHead sortKey="end" currentSort={sort} onSort={toggleSort} className="text-base whitespace-nowrap">จบคอร์ส</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/enrollments/${r.id}`)}>
                    <TableCell>
                      <div className="font-medium">{r.studentNickname || r.studentName}</div>
                      {r.studentNickname && r.studentNickname !== r.studentName && (
                        <div className="text-gray-500">{r.studentName}</div>
                      )}
                      <div className="text-gray-500">{r.parentName || '—'}{r.parentPhone && ` · ${r.parentPhone}`}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.branchName}</TableCell>
                    <TableCell>
                      <div>{r.subject}</div>
                      <div className="text-gray-500">{r.classCode}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap num">{thaiDateLabel(r.enrolledAt)}</TableCell>
                    <TableCell className="whitespace-nowrap num">
                      <div>{thaiDateLabel(r.paidDate)}</div>
                      {r.paymentMethod && <div className="text-gray-500">{METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod}</div>}
                    </TableCell>
                    <TableCell className="num">
                      <div className="font-medium text-orange-600">ขาด {formatBaht(r.gap)}</div>
                      <div className="text-gray-500">ราคา {formatBaht(r.finalPrice)} · ลงแล้ว {formatBaht(r.paidAmount)}</div>
                      <div className="text-gray-500">รายการรับเงิน {r.transactions} รายการ</div>
                    </TableCell>
                    <TableCell><ProgressCell row={r} today={today} /></TableCell>
                    <TableCell className="whitespace-nowrap num">
                      <div>{thaiDateLabel(r.classEnd)}</div>
                      <div className="text-gray-500">เริ่ม {thaiDateLabel(r.classStart)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
