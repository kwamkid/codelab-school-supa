'use client'

// รายงานประเมินครูรายเดือน — ครูแต่ละคนสอนไปกี่คาบ **เช็คชื่อเองกี่คาบ** และส่ง
// Teacher Feedback ให้ผู้ปกครองกี่คาบ (+ ชดเชย/ทดลองเรียน) ในเดือนที่เลือก
// ข้อมูลมาจาก RPC get_teacher_monthly_report ผ่าน /api/admin/reports/teacher-monthly
// (1 query) — ครูสอนแทนถูกนับให้คนที่สอนจริงผ่าน actual_teacher_id
// เลือกเดือนด้วย MonthPicker (monthly view ของ shared calendar)

import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { useBranch } from '@/contexts/BranchContext'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { MonthPicker, currentMonthStr } from '@/components/ui/calendar'
import { Tooltip } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortableTableHead, useSortableTable } from '@/components/ui/sortable-table-head'
import { EmptyState } from '@/components/ui/empty-state'
import { Loading, PageLoading } from '@/components/ui/loading'
import { cn } from '@/lib/utils'
import {
  ClipboardCheck, Download, MessageSquare, UserCheck,
  CalendarCheck, Users, ImageIcon, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

interface SessionRef {
  date: string
  label: string
  no: number
  /** ชื่อคนที่เช็คให้ (เฉพาะรายการ "คนอื่นเช็คให้") */
  by?: string | null
}

interface TeacherRow {
  id: string
  nickname: string
  name: string
  isActive: boolean
  sessions: number
  checked: number
  selfChecked: number
  otherChecked: number
  unknownChecked: number
  fbSessions: number
  photoSessions: number
  attended: number
  fbStudents: number
  makeupTotal: number
  makeupChecked: number
  trialTotal: number
  trialChecked: number
  uncheckedList: SessionRef[]
  otherCheckedList: SessionRef[]
  noFbList: SessionRef[]
}

interface ReportData {
  month: string
  monthStart: string
  monthEnd: string
  cutoff: string
  partial: boolean
  totals: {
    teachers: number
    sessions: number
    checked: number
    selfChecked: number
    otherChecked: number
    unknownChecked: number
    fbSessions: number
    photoSessions: number
    attended: number
    fbStudents: number
    makeup: number
    trial: number
    noFbTeachers: number
  }
  teachers: TeacherRow[]
}

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

/** 'YYYY-MM-DD' → '6 ส.ค.' (ไม่แปลงเป็น Date เพื่อกันปัญหา timezone) */
function dayLabel(d: string): string {
  const [, m, day] = d.split('-').map(Number)
  return `${day} ${THAI_MONTHS_SHORT[m - 1]}`
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

/** ผลประเมินจากสัดส่วน "คาบที่ส่ง feedback ÷ คาบที่สอน" */
function grade(row: TeacherRow) {
  if (row.sessions === 0) return null
  const rate = pct(row.fbSessions, row.sessions)
  if (rate >= 80) return { label: 'ดีเยี่ยม', cls: 'bg-emerald-100 text-emerald-700' }
  if (rate >= 50) return { label: 'ดี', cls: 'bg-blue-100 text-blue-700' }
  if (rate >= 20) return { label: 'พอใช้', cls: 'bg-amber-100 text-amber-700' }
  if (rate > 0) return { label: 'ต้องปรับปรุง', cls: 'bg-orange-100 text-orange-700' }
  return { label: 'ยังไม่ส่งเลย', cls: 'bg-red-100 text-red-700' }
}

/** แถบสัดส่วน x/y + % ใต้ตัวเลข */
function RateCell({ value, total, color }: { value: number; total: number; color: string }) {
  const p = pct(value, total)
  return (
    <div className="min-w-[92px]">
      <div className="flex items-baseline gap-1 tabular-nums">
        <span className="font-semibold">{value}</span>
        <span className="text-gray-400">/ {total}</span>
        <span className="ml-auto text-xs text-gray-500">{total > 0 ? `${p}%` : '—'}</span>
      </div>
      <div className="h-1.5 mt-1 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${p}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

/** ป้ายจำนวนคาบ — hover เพื่อดูว่าเป็นคาบไหนบ้าง (และใครเช็คให้) */
function SessionsBadge({ list, text, cls }: { list: SessionRef[]; text: string; cls: string }) {
  if (!list.length) return null
  const shown = list.slice(0, 12)
  return (
    <Tooltip
      label={
        <span className="block max-w-[300px] py-0.5 leading-relaxed">
          {shown
            .map((s) => `${dayLabel(s.date)} ${s.label} (ครั้งที่ ${s.no})${s.by ? ` — ${s.by}` : ''}`)
            .join(' · ')}
          {list.length > shown.length && ` · อีก ${list.length - shown.length} คาบ`}
        </span>
      }
    >
      <span className={cn('inline-block mt-1 rounded px-1.5 py-0.5 text-xs cursor-default', cls)}>
        {text}
      </span>
    </Tooltip>
  )
}

export default function TeacherMonthlyReportPage() {
  const { selectedBranchId } = useBranch()
  const [month, setMonth] = useState(currentMonthStr())
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const { sort, toggle: toggleSort, sortRows } = useSortableTable()

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const qs = new URLSearchParams({ month })
      if (selectedBranchId) qs.set('branchId', selectedBranchId)
      const res = await authFetch(`/api/admin/reports/teacher-monthly?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'โหลดรายงานไม่สำเร็จ')
      setData(json)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'โหลดรายงานไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [month, selectedBranchId])

  useEffect(() => { load() }, [load])

  const t = data?.totals

  const rows = useMemo(() => {
    const list = data?.teachers || []
    return sortRows(list, (r, key) => {
      switch (key) {
        case 'teacher': return r.nickname
        case 'sessions': return r.sessions
        case 'checked': return pct(r.checked, r.sessions)
        case 'self': return pct(r.selfChecked, r.sessions)
        case 'feedback': return pct(r.fbSessions, r.sessions)
        case 'students': return pct(r.fbStudents, r.attended)
        case 'photos': return r.photoSessions
        case 'extra': return r.makeupTotal + r.trialTotal
        default: return ''
      }
    })
  }, [data, sortRows])

  const exportCsv = () => {
    if (!data || !rows.length) return
    const head = [
      'ครู', 'ชื่อ-นามสกุล', 'คาบที่สอน', 'เช็คชื่อ', '%เช็คชื่อ', 'ครูเช็คเอง', '%ครูเช็คเอง',
      'คนอื่นเช็คให้', 'ไม่ทราบผู้เช็ค', 'คาบที่ส่ง feedback', '%feedback',
      'นักเรียนที่มาเรียน', 'นักเรียนที่ได้ feedback', 'คาบที่แนบรูป',
      'สอนชดเชย', 'สอนทดลอง', 'ผลประเมิน',
    ]
    const lines = rows.map((r) => [
      r.nickname, r.name, r.sessions, r.checked, pct(r.checked, r.sessions),
      r.selfChecked, pct(r.selfChecked, r.sessions), r.otherChecked, r.unknownChecked,
      r.fbSessions, pct(r.fbSessions, r.sessions), r.attended, r.fbStudents,
      r.photoSessions, r.makeupTotal, r.trialTotal, grade(r)?.label ?? '-',
    ])
    const csv = [head, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ประเมินครู_${data.month}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (loading && !data) return <PageLoading />

  return (
    <div className="p-4 sm:p-6 text-base relative">
      {loading && data && (
        <div className="absolute inset-0 z-20 bg-white/60 flex items-start justify-center pt-32">
          <Loading size="md" />
        </div>
      )}
      <div className={cn(loading && data && 'pointer-events-none')}>
        <PageHeader
          title="ประเมินครูรายเดือน"
          icon={ClipboardCheck}
          iconColor="text-indigo-600"
          description="ครูแต่ละคนสอนกี่คาบ เช็คชื่อเองกี่คาบ และส่ง Feedback ให้ผู้ปกครองกี่คาบ"
          action={
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          }
        />

        <div className="space-y-4">
          {/* เลือกเดือน — monthly view ของ shared calendar */}
          <div className="flex items-center gap-3 flex-wrap">
            <MonthPicker value={month} onChange={setMonth} />
            {data?.partial && (
              <span className="text-sm text-gray-500">
                นับถึง {dayLabel(data.cutoff)} (เดือนนี้ยังไม่จบ)
              </span>
            )}
          </div>

          {/* สรุปรวม */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="rounded-xl p-4 text-white bg-gradient-to-br from-indigo-500 to-indigo-600">
              <div className="flex items-center gap-2 text-white/90 text-sm">
                <CalendarCheck className="h-4 w-4" /> คาบที่สอน
              </div>
              <div className="text-3xl font-bold mt-1">{t?.sessions ?? 0}</div>
              <div className="text-white/80 text-sm mt-1">
                ชดเชย {t?.makeup ?? 0} · ทดลอง {t?.trial ?? 0}
              </div>
            </div>
            <div className="rounded-xl p-4 text-white bg-gradient-to-br from-blue-500 to-blue-600">
              <div className="flex items-center gap-2 text-white/90 text-sm">
                <Users className="h-4 w-4" /> เช็คชื่อแล้ว
              </div>
              <div className="text-3xl font-bold mt-1">{pct(t?.checked ?? 0, t?.sessions ?? 0)}%</div>
              <div className="text-white/80 text-sm mt-1">
                {t?.checked ?? 0} คาบ · ยังไม่เช็ค {(t?.sessions ?? 0) - (t?.checked ?? 0)}
              </div>
            </div>
            <div className="rounded-xl p-4 text-white bg-gradient-to-br from-violet-500 to-violet-600">
              <div className="flex items-center gap-2 text-white/90 text-sm">
                <UserCheck className="h-4 w-4" /> ครูเช็คเอง
              </div>
              <div className="text-3xl font-bold mt-1">{pct(t?.selfChecked ?? 0, t?.sessions ?? 0)}%</div>
              <div className="text-white/80 text-sm mt-1">
                {t?.selfChecked ?? 0} คาบ · คนอื่นเช็คให้ {(t?.otherChecked ?? 0) + (t?.unknownChecked ?? 0)}
              </div>
            </div>
            <div className="rounded-xl p-4 text-white bg-gradient-to-br from-emerald-500 to-emerald-600">
              <div className="flex items-center gap-2 text-white/90 text-sm">
                <MessageSquare className="h-4 w-4" /> ส่ง Feedback
              </div>
              <div className="text-3xl font-bold mt-1">{pct(t?.fbSessions ?? 0, t?.sessions ?? 0)}%</div>
              <div className="text-white/80 text-sm mt-1">
                {t?.fbSessions ?? 0} คาบ · {t?.fbStudents ?? 0} คน
              </div>
            </div>
            <div className="rounded-xl p-4 text-white bg-gradient-to-br from-rose-500 to-rose-600">
              <div className="flex items-center gap-2 text-white/90 text-sm">
                <AlertTriangle className="h-4 w-4" /> ครูที่ยังไม่ส่งเลย
              </div>
              <div className="text-3xl font-bold mt-1">{t?.noFbTeachers ?? 0}</div>
              <div className="text-white/80 text-sm mt-1">จากครู {t?.teachers ?? 0} คนที่มีคาบสอน</div>
            </div>
          </div>

          {/* ตาราง */}
          {rows.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="ไม่มีคาบสอนในเดือนนี้"
              description="ลองเลือกเดือนอื่น หรือเปลี่ยนสาขาด้านบน"
            />
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="teacher" currentSort={sort} onSort={toggleSort} className="min-w-[140px] text-base">
                      ครู
                    </SortableTableHead>
                    <SortableTableHead sortKey="sessions" currentSort={sort} onSort={toggleSort} className="w-[100px] text-base">
                      คาบที่สอน
                    </SortableTableHead>
                    <SortableTableHead sortKey="checked" currentSort={sort} onSort={toggleSort} className="w-[150px] text-base">
                      เช็คชื่อ (ทั้งหมด)
                    </SortableTableHead>
                    <SortableTableHead sortKey="self" currentSort={sort} onSort={toggleSort} className="w-[170px] text-base">
                      ครูเช็คเอง
                    </SortableTableHead>
                    <SortableTableHead sortKey="feedback" currentSort={sort} onSort={toggleSort} className="w-[150px] text-base">
                      ส่ง Feedback
                    </SortableTableHead>
                    <SortableTableHead sortKey="students" currentSort={sort} onSort={toggleSort} className="w-[140px] text-base">
                      นักเรียนที่ได้ Feedback
                    </SortableTableHead>
                    <SortableTableHead sortKey="photos" currentSort={sort} onSort={toggleSort} className="w-[80px] text-base">
                      แนบรูป
                    </SortableTableHead>
                    <SortableTableHead sortKey="extra" currentSort={sort} onSort={toggleSort} className="w-[120px] text-base">
                      ชดเชย / ทดลอง
                    </SortableTableHead>
                    <TableHead className="w-[120px] text-base">ผลประเมิน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const g = grade(r)
                    return (
                      <TableRow key={r.id} className={cn(r.sessions > 0 && r.fbSessions === 0 && 'bg-rose-50/50')}>
                        <TableCell>
                          <div className="font-medium">{r.nickname}</div>
                          {r.name && r.name !== r.nickname && (
                            <div className="text-xs text-gray-500 truncate max-w-[160px]">{r.name}</div>
                          )}
                          {!r.isActive && (
                            <span className="inline-block mt-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                              ปิดใช้งาน
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums font-semibold">{r.sessions}</TableCell>
                        <TableCell>
                          <RateCell value={r.checked} total={r.sessions} color="#3B82F6" />
                          <SessionsBadge
                            list={r.uncheckedList}
                            text={`ยังไม่เช็ค ${r.uncheckedList.length} คาบ`}
                            cls="bg-red-100 text-red-700"
                          />
                        </TableCell>
                        <TableCell>
                          <RateCell value={r.selfChecked} total={r.sessions} color="#8B5CF6" />
                          <SessionsBadge
                            list={r.otherCheckedList}
                            text={`คนอื่นเช็คให้ ${r.otherChecked + r.unknownChecked} คาบ`}
                            cls="bg-gray-100 text-gray-600"
                          />
                        </TableCell>
                        <TableCell>
                          <RateCell value={r.fbSessions} total={r.sessions} color="#10B981" />
                          <SessionsBadge
                            list={r.noFbList}
                            text={`เช็คแล้วไม่ส่ง ${r.noFbList.length} คาบ`}
                            cls="bg-amber-100 text-amber-700"
                          />
                        </TableCell>
                        <TableCell>
                          <RateCell value={r.fbStudents} total={r.attended} color="#EC4899" />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {r.photoSessions > 0 ? (
                            <span className="inline-flex items-center gap-1 text-gray-700">
                              <ImageIcon className="h-4 w-4 text-gray-400" /> {r.photoSessions}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums text-gray-600">
                          {r.makeupTotal} / {r.trialTotal}
                        </TableCell>
                        <TableCell>
                          {g ? (
                            <span className={cn('inline-block rounded-full px-2.5 py-1 text-sm font-medium', g.cls)}>
                              {g.label}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="text-sm text-gray-500 space-y-1">
            <p>
              นับเฉพาะคาบที่ผ่านไปแล้วของคลาสที่เปิดสอน (ไม่รวมคาบที่ยกเลิก) — ครูสอนแทนถูกนับให้คนที่สอนจริง
            </p>
            <p>
              <b>ครูเช็คเอง</b> = คาบที่คนกดบันทึกเช็คชื่อคือครูเจ้าของคาบเอง (ดูจากบัญชีที่ล็อกอินตอนกดบันทึก) ·
              <b> คนอื่นเช็คให้</b> = แอดมินหรือครูคนอื่นกดแทน รวมถึงคาบเก่าที่ระบบไม่ได้บันทึกว่าใครเป็นคนเช็ค
              (ชี้เมาส์ที่ป้ายเพื่อดูว่าเป็นคาบไหน ใครเช็คให้) · ครูเริ่มเช็คชื่อเองผ่านหน้า “ครู” ได้ตั้งแต่ มิ.ย. 69
            </p>
            <p>
              <b>ส่ง Feedback</b> = คาบที่มีนักเรียนอย่างน้อย 1 คนได้รับ Feedback (ต้องเช็คชื่อก่อนถึงจะส่งได้) ·
              ผลประเมินคิดจากสัดส่วนคาบที่ส่ง Feedback ต่อคาบที่สอน
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
