'use client'

// Admin review of parent practice proposals. Loads all proposals, filters by
// status (shared StatusFilterTabs with per-status counts) + team, and supports
// approve / reject / edit-time inline. Approving/editing notifies the parent.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StudentBadge } from '@/components/ui/student-badge'
import { StatusFilterTabs, type StatusFilterTab } from '@/components/ui/status-filter-tabs'
import { SectionLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { Check, X, CalendarClock, RotateCcw, Clock } from 'lucide-react'
import type { PracticeStatus } from '@/lib/vex/types'

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

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
function splitDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { day: d, month: THAI_MONTHS_SHORT[m - 1] || '', year: String(y % 100).padStart(2, '0') }
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
  const [all, setAll] = useState<PracticeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<PracticeStatus | 'all'>('proposed')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Load ALL statuses once so the tab counts are accurate; filter client-side.
      const res = await authFetch('/api/admin/vex/practices?status=all')
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'โหลดคำขอไม่สำเร็จ')
        return
      }
      const rows: PracticeRow[] = data.practices || []
      setAll(rows)
      onPendingCount?.(rows.filter((r) => r.status === 'proposed').length)
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }, [onPendingCount])

  useEffect(() => {
    load()
  }, [load])

  // Team-scoped set (status counts reflect the team filter).
  const teamScoped = useMemo(
    () => (teamFilter === 'all' ? all : all.filter((r) => r.team_id === teamFilter)),
    [all, teamFilter]
  )

  const counts = useMemo(
    () => ({
      proposed: teamScoped.filter((r) => r.status === 'proposed').length,
      approved: teamScoped.filter((r) => r.status === 'approved').length,
      rejected: teamScoped.filter((r) => r.status === 'rejected').length,
      all: teamScoped.length,
    }),
    [teamScoped]
  )

  const rows = useMemo(
    () => (statusFilter === 'all' ? teamScoped : teamScoped.filter((r) => r.status === statusFilter)),
    [teamScoped, statusFilter]
  )

  const filterTabs: StatusFilterTab[] = [
    { value: 'proposed', label: 'รออนุมัติ', count: counts.proposed, activeBg: 'bg-amber-500', inactiveBg: 'bg-amber-50', inactiveLabel: 'text-amber-700', inactiveCount: 'text-amber-700', always: true },
    { value: 'approved', label: 'อนุมัติแล้ว', count: counts.approved, activeBg: 'bg-green-600', inactiveBg: 'bg-green-50', inactiveLabel: 'text-green-700', inactiveCount: 'text-green-700', always: true },
    { value: 'rejected', label: 'ไม่อนุมัติ', count: counts.rejected, activeBg: 'bg-red-600', inactiveBg: 'bg-red-50', inactiveLabel: 'text-red-700', inactiveCount: 'text-red-700', always: true },
    { value: 'all', label: 'ทั้งหมด', count: counts.all, activeBg: 'bg-gray-700', inactiveBg: 'bg-gray-100', inactiveLabel: 'text-gray-600', inactiveCount: 'text-gray-700', always: true, separatorBefore: true },
  ]

  const patch = async (id: string, body: any, successMsg: string) => {
    if (busyId) return null
    setBusyId(id)
    try {
      const res = await authFetch(`/api/admin/vex/practices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'บันทึกไม่สำเร็จ')
        return null
      }
      toast.success(successMsg)
      setAll((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, ...data.practice } : r))
        onPendingCount?.(next.filter((r) => r.status === 'proposed').length)
        return next
      })
      return data.practice as PracticeRow
    } catch {
      toast.error('เกิดข้อผิดพลาด')
      return null
    } finally {
      setBusyId(null)
    }
  }

  const review = (id: string, status: PracticeStatus) =>
    patch(
      id,
      { status },
      status === 'approved' ? 'อนุมัติแล้ว' : status === 'rejected' ? 'ปฏิเสธแล้ว' : 'ย้อนกลับเป็นรออนุมัติ'
    )

  return (
    <div className="space-y-4">
      {/* Filters: status tabs (shared) + team dropdown */}
      <div className="flex flex-col gap-3">
        <StatusFilterTabs tabs={filterTabs} value={statusFilter} onChange={(v) => setStatusFilter(v as any)} />
        {teams.length > 1 && (
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-[220px]">
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
          {rows.map((p) => {
            const d = splitDate(p.practice_date)
            const isEditing = editingId === p.id
            return (
              <Card key={p.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Prominent date block */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="shrink-0 w-16 text-center leading-none pt-0.5">
                      <div className="text-3xl font-bold text-gray-900">{d.day}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {d.month} {d.year}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <EditTimeForm
                          practice={p}
                          busy={busyId === p.id}
                          onCancel={() => setEditingId(null)}
                          onSave={async (start, end) => {
                            const updated = await patch(
                              p.id,
                              { start_time: start || null, end_time: end || null },
                              'ปรับเวลาแล้ว (แจ้งผู้ปกครองแล้ว)'
                            )
                            if (updated) setEditingId(null)
                          }}
                        />
                      ) : (
                        <>
                          <div className="text-lg font-bold text-gray-900">
                            {p.start_time ? hhmm(p.start_time) : '—'}
                            {p.end_time ? <span className="text-gray-400 font-semibold"> - {hhmm(p.end_time)}</span> : ''}
                          </div>
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
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!isEditing && (
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(p.id)}
                        disabled={busyId === p.id}
                        className="gap-1"
                      >
                        <Clock className="h-4 w-4" /> ปรับเวลา
                      </Button>
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
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Inline edit-time form (start/end only; date stays fixed).
function EditTimeForm({
  practice,
  busy,
  onSave,
  onCancel,
}: {
  practice: PracticeRow
  busy: boolean
  onSave: (start: string, end: string) => void
  onCancel: () => void
}) {
  const [start, setStart] = useState(hhmm(practice.start_time) || '09:00')
  const [end, setEnd] = useState(hhmm(practice.end_time) || '12:00')

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 max-w-xs">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">เวลาเริ่ม</Label>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">เวลาจบ</Label>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
          ยกเลิก
        </Button>
        <Button
          size="sm"
          onClick={() => {
            if (start && end && end <= start) {
              toast.error('เวลาสิ้นสุดต้องหลังเวลาเริ่ม')
              return
            }
            onSave(start, end)
          }}
          disabled={busy}
        >
          {busy ? 'กำลังบันทึก...' : 'บันทึกเวลา'}
        </Button>
      </div>
    </div>
  )
}
