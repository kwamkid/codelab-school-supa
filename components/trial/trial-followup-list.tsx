'use client'

// แท็บ "ควรโทรตาม" ในหน้า /trial — คนที่มาทดลองเรียนแล้วแต่ครอบครัวยังไม่สมัครคอร์สใดเลย
// หลังวันทดลอง (จับคู่ด้วยเบอร์โทร กติกาเดียวกับ conversion ในรายงานผู้บริหาร) · 1 แถวต่อเด็กต่อการจอง
// ไม่รวมการจองที่ยกเลิก/ลงทะเบียนแล้ว · API จำกัดให้แอดมินสาขาเห็นเฉพาะสาขาตัวเอง
// ข้อมูลจาก /api/admin/trial/followups → RPC get_trial_followups

import Link from 'next/link'
import { PhoneCall } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FormSelect } from '@/components/ui/form-select'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionLoading } from '@/components/ui/loading'
import { Button } from '@/components/ui/button'
import { Pill, type PillTone } from '@/components/ui/pill'
import { thaiDateLabel } from '@/lib/format'

export interface TrialFollowup {
  sessionId: string
  bookingId: string
  parentName: string
  parentPhone: string
  studentName: string
  subject: string
  branchId: string
  branchName: string
  teacher: string | null
  trialDate: string
  /** มาทดลองกี่ครั้งใน booking นี้ (แถวนี้ = ครั้งล่าสุด) */
  trialCount: number
  daysAgo: number
  interestedLevel: 'high' | 'medium' | 'low' | 'not_interested' | null
  feedback: string | null
  contactNote: string | null
  source: string
  existingCustomer: boolean
}

export const FOLLOWUP_DAY_OPTIONS = [
  { value: '30', label: '30 วันล่าสุด' },
  { value: '60', label: '60 วันล่าสุด' },
  { value: '120', label: '120 วันล่าสุด' },
  { value: '365', label: '1 ปีล่าสุด' },
  { value: '3650', label: 'ทั้งหมด' },
]

const INTEREST: Record<string, { label: string; tone: PillTone }> = {
  high: { label: 'สนใจมาก', tone: 'emerald' },
  medium: { label: 'สนใจ', tone: 'blue' },
  low: { label: 'สนใจน้อย', tone: 'amber' },
  not_interested: { label: 'ไม่สนใจ', tone: 'gray' },
}

/** ป้ายความเร่งด่วนจากจำนวนวันหลังทดลองเรียน */
function urgency(daysAgo: number): { label: string; tone: PillTone } {
  if (daysAgo <= 7) return { label: 'ควรโทรเลย', tone: 'red' }
  if (daysAgo <= 30) return { label: 'ยังทัน', tone: 'amber' }
  return { label: 'นานแล้ว', tone: 'gray' }
}

interface Props {
  rows: TrialFollowup[]
  loading: boolean
  days: string
  onDaysChange: (v: string) => void
  searchTerm: string
  showBranch: boolean
}

export function TrialFollowupList({ rows, loading, days, onDaysChange, searchTerm, showBranch }: Props) {
  const q = searchTerm.trim().toLowerCase()
  const list = q
    ? rows.filter((r) => [r.parentName, r.parentPhone, r.studentName, r.subject].some((v) => v?.toLowerCase().includes(q)))
    : rows

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <FormSelect value={days} onValueChange={onDaysChange} options={FOLLOWUP_DAY_OPTIONS} className="w-[200px]" />
        <p className="text-gray-600">
          มาทดลองเรียนแล้ว แต่ครอบครัวยังไม่ได้สมัครคอร์สใดเลยหลังวันทดลอง (ดูจากเบอร์โทร) · ถ้าสมัครแล้ว รายชื่อจะหายไปเอง
        </p>
      </div>

      {loading ? (
        <SectionLoading />
      ) : list.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title={q ? 'ไม่พบรายชื่อที่ค้นหา' : 'ไม่มีรายชื่อที่ต้องโทรตาม'}
          description={q ? undefined : 'ทุกคนที่มาทดลองเรียนในช่วงนี้สมัครคอร์สแล้ว'}
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">วันที่ทดลอง</TableHead>
                <TableHead className="min-w-[180px]">ผู้ปกครอง</TableHead>
                <TableHead className="min-w-[150px]">นักเรียน</TableHead>
                <TableHead className="min-w-[160px]">วิชา · ครู</TableHead>
                {showBranch && <TableHead>สาขา</TableHead>}
                <TableHead className="min-w-[220px]">บันทึก</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => {
                const u = urgency(r.daysAgo)
                const interest = r.interestedLevel ? INTEREST[r.interestedLevel] : null
                return (
                  <TableRow key={r.sessionId}>
                    <TableCell className="num whitespace-nowrap">
                      <div>{thaiDateLabel(r.trialDate)}{r.trialCount > 1 && <span className="text-gray-500"> (มา {r.trialCount} ครั้ง)</span>}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-gray-500">{r.daysAgo} วันก่อน</span>
                        <Pill tone={u.tone}>{u.label}</Pill>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.parentName}</div>
                      <a href={`tel:${r.parentPhone}`} className="num text-blue-600 hover:underline">{r.parentPhone}</a>
                      {r.existingCustomer && <Pill tone="indigo" className="ml-2">ลูกค้าเก่า</Pill>}
                    </TableCell>
                    <TableCell>
                      <div>{r.studentName}</div>
                      {interest && <Pill tone={interest.tone} className="mt-1">{interest.label}</Pill>}
                    </TableCell>
                    <TableCell>
                      <div>{r.subject}</div>
                      <div className="text-gray-500">ครู{r.teacher || ' -'}</div>
                    </TableCell>
                    {showBranch && <TableCell className="whitespace-nowrap">{r.branchName}</TableCell>}
                    <TableCell className="text-gray-600">
                      {r.feedback && <div className="line-clamp-2">ครู: {r.feedback}</div>}
                      {r.contactNote && <div className="line-clamp-2">{r.contactNote}</div>}
                      {!r.feedback && !r.contactNote && <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="outline">
                        <Link href={`/trial/${r.bookingId}`}>ดูการจอง</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
