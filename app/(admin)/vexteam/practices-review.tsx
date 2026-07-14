'use client'

// Admin review of parent practice proposals. List all proposals with status +
// team filter, approve/reject inline. Reviewed rows can be re-opened.

import { useEffect, useState, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StudentBadge } from '@/components/ui/student-badge'
import { SectionLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { Check, X, CalendarClock, RotateCcw } from 'lucide-react'
import type { PracticeStatus } from '@/lib/vex/types'

// "14", "ก.ค.", "26" from a YYYY-MM-DD string (for the prominent date block).
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
function splitDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { day: d, month: THAI_MONTHS_SHORT[m - 1] || '', year: String(y % 100).padStart(2, '0') }
}

interface PracticeRow {
  id: string
  team_id: string
  kid_id: string
  practice_date: string
  start_time: string | null
  end_time: string | null
  note: string | null
  status: PracticeStatus
  edited_by_admin: boolean
  kidNickname: string | null
  teamNumber: string | null
  teamName: string | null
}

interface TeamOption {
  id: string
  team_number: string
  name: string | null
}

const STATUS_META: Record<PracticeStatus, { label: string; chip: string }> = {
  proposed: { label: 'รออนุมัติ', chip: 'bg-amber-100 text-amber-800' },
  approved: { label: 'อนุมัติแล้ว', chip: 'bg-green-100 text-green-700' },
  rejected: { label: 'ไม่อนุมัติ', chip: 'bg-red-100 text-red-600' },
}

function hhmm(t: string | null) {
  return t ? t.slice(0, 5) : ''
}

export function PracticesReview({
  teams,
  onPendingCount,
}: {
  teams: TeamOption[]
  onPendingCount?: (n: number) => void
}) {
  const [rows, setRows] = useState<PracticeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<PracticeStatus | 'all'>('proposed')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (teamFilter !== 'all') params.set('team_id', teamFilter)
    try {
      const res = await authFetch(`/api/admin/vex/practices?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'โหลดคำขอไม่สำเร็จ')
        return
      }
      setRows(data.practices || [])
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, teamFilter])

  useEffect(() => {
    load()
  }, [load])

  const review = async (id: string, status: PracticeStatus) => {
    if (busyId) return
    setBusyId(id)
    try {
      const res = await authFetch(`/api/admin/vex/practices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'บันทึกไม่สำเร็จ')
        return
      }
      toast.success(
        status === 'approved' ? 'อนุมัติแล้ว' : status === 'rejected' ? 'ปฏิเสธแล้ว' : 'ย้อนกลับเป็นรออนุมัติ'
      )
      // Update in place, then recompute the pending badge.
      setRows((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, status } : r))
        onPendingCount?.(next.filter((r) => r.status === 'proposed').length)
        // If a status filter is active and this row no longer matches, drop it.
        return statusFilter !== 'all' ? next.filter((r) => r.status === statusFilter) : next
      })
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters: status as tabs, team as a dropdown (larger dataset). */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as PracticeStatus | 'all')}>
          <TabsList>
            <TabsTrigger value="proposed">รออนุมัติ</TabsTrigger>
            <TabsTrigger value="approved">อนุมัติแล้ว</TabsTrigger>
            <TabsTrigger value="rejected">ไม่อนุมัติ</TabsTrigger>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
          </TabsList>
        </Tabs>
        {teams.length > 1 && (
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกทีม</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.team_number}
                  {t.name ? ` — ${t.name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <SectionLoading />
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title="ไม่มีคำขอซ้อม" description="คำขอจากผู้ปกครองจะแสดงที่นี่" />
      ) : (
        <div className="grid gap-3">
          {rows.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Prominent date block */}
                {(() => {
                  const d = splitDate(p.practice_date)
                  return (
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="shrink-0 w-16 text-center leading-none">
                        <div className="text-3xl font-bold text-gray-900">{d.day}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {d.month} {d.year}
                        </div>
                      </div>
                      <div className="min-w-0">
                        {/* prominent time */}
                        <div className="text-lg font-bold text-gray-900">
                          {p.start_time ? hhmm(p.start_time) : '—'}
                          {p.end_time ? <span className="text-gray-400 font-semibold"> - {hhmm(p.end_time)}</span> : ''}
                        </div>
                        {/* kid + team */}
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <StudentBadge name={p.kidNickname} />
                          <span className="text-sm text-gray-500">
                            {p.teamNumber}
                            {p.teamName ? ` (${p.teamName})` : ''}
                          </span>
                          {p.edited_by_admin && (
                            <Badge variant="outline" className="text-[10px]">แก้โดยแอดมิน</Badge>
                          )}
                        </div>
                        {p.note && <div className="text-xs text-gray-500 mt-1 truncate">{p.note}</div>}
                      </div>
                    </div>
                  )
                })()}

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {p.status === 'proposed' ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => review(p.id, 'approved')}
                        disabled={busyId === p.id}
                        className="gap-1 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4" /> อนุมัติ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => review(p.id, 'rejected')}
                        disabled={busyId === p.id}
                        className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" /> ปฏิเสธ
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge className={STATUS_META[p.status].chip}>{STATUS_META[p.status].label}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => review(p.id, 'proposed')}
                        disabled={busyId === p.id}
                        className="gap-1 text-gray-500"
                        title="ย้อนกลับเป็นรออนุมัติ"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
