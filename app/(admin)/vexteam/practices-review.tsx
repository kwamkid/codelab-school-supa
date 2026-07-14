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
import { TimeRangePicker } from '@/components/ui/time-range-picker'
import { FormSelect, type FormSelectOption } from '@/components/ui/form-select'
import { StudentBadge } from '@/components/ui/student-badge'
import { StatusFilterTabs, type StatusFilterTab } from '@/components/ui/status-filter-tabs'
import { useBranch } from '@/contexts/BranchContext'
import { cn } from '@/lib/utils'
import { PracticeMonthView } from './practice-month-view'
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
  branch_id: string | null
}

interface TeamOption {
  id: string
  team_number: string
  name: string | null
  branch_id?: string | null
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
  const { selectedBranchId } = useBranch()
  const [all, setAll] = useState<PracticeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<PracticeStatus | 'all'>('proposed')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'calendar'>('list')

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

  // Scope by the top-bar branch first, then the team filter (status counts
  // reflect both).
  const teamScoped = useMemo(() => {
    let list = selectedBranchId ? all.filter((r) => r.branch_id === selectedBranchId) : all
    if (teamFilter !== 'all') list = list.filter((r) => r.team_id === teamFilter)
    return list
  }, [all, selectedBranchId, teamFilter])

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

  // Team filter options (auto-searchable when >7). Scoped to the selected branch.
  const teamSearchOptions = useMemo<FormSelectOption[]>(() => {
    const scoped = selectedBranchId ? teams.filter((t) => t.branch_id === selectedBranchId) : teams
    return [
      { value: 'all', label: 'ทุกทีม' },
      ...scoped.map((t) => ({ value: t.id, label: `${t.team_number}${t.name ? ` — ${t.name}` : ''}` })),
    ]
  }, [teams, selectedBranchId])

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
      // Let the sidebar badge refresh its pending count.
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('vex-practices-changed'))
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
      {/* Filters: status tabs (shared) */}
      <div className="flex flex-col gap-3">
        <StatusFilterTabs tabs={filterTabs} value={statusFilter} onChange={(v) => setStatusFilter(v as any)} />

        {/* Searchable team filter (left) + list/calendar toggle (right) on one row */}
        <div className="flex items-center gap-3">
          {teams.length > 1 && (
            <FormSelect
              options={teamSearchOptions}
              value={teamFilter}
              onValueChange={setTeamFilter}
              placeholder="ทุกทีม"
              searchPlaceholder="ค้นหาทีม..."
              className="w-full sm:max-w-xs"
            />
          )}
          <div className="ml-auto inline-flex rounded-md border overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setView('list')}
              className={cn('px-3 py-1.5 text-sm font-medium', view === 'list' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
            >
              รายการ
            </button>
            <button
              type="button"
              onClick={() => setView('calendar')}
              className={cn('px-3 py-1.5 text-sm font-medium border-l', view === 'calendar' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
            >
              ปฏิทิน
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <SectionLoading />
      ) : view === 'calendar' ? (
        // Calendar shows all (branch+team-scoped) practices coloured by status.
        <PracticeMonthView
          practices={teamScoped.map((p) => ({
            id: p.id,
            kid_id: p.kid_id,
            practice_date: p.practice_date,
            start_time: p.start_time,
            end_time: p.end_time,
            status: p.status,
            kidNickname: p.kidNickname,
            teamNumber: p.teamNumber,
          }))}
          onReview={review}
          busyId={busyId}
        />
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title="ไม่มีคำขอซ้อม" description="คำขอจากผู้ปกครองจะแสดงที่นี่" />
      ) : (
        <div className="grid gap-3">
          {rows.map((p) => {
            const d = splitDate(p.practice_date)
            const isEditing = editingId === p.id
            return (
              <Card key={p.id}>
                <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Prominent date block */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="shrink-0 w-14 text-center leading-none">
                      <div className="text-2xl font-bold text-gray-900">{d.day}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {d.month} {d.year}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <EditTimeForm
                          practice={p}
                          busy={busyId === p.id}
                          onCancel={() => setEditingId(null)}
                          onSave={async (start, end, approve) => {
                            const body: any = { start_time: start || null, end_time: end || null }
                            if (approve) body.status = 'approved'
                            const updated = await patch(
                              p.id,
                              body,
                              approve ? 'ปรับเวลา + อนุมัติแล้ว (แจ้งผู้ปกครองแล้ว)' : 'ปรับเวลาแล้ว (แจ้งผู้ปกครองแล้ว)'
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

// Inline edit-time form (start/end only; date stays fixed). `approve` on save
// commits the new time AND approves in one step.
function EditTimeForm({
  practice,
  busy,
  onSave,
  onCancel,
}: {
  practice: PracticeRow
  busy: boolean
  onSave: (start: string, end: string, approve: boolean) => void
  onCancel: () => void
}) {
  const [start, setStart] = useState(hhmm(practice.start_time) || '09:00')
  const [end, setEnd] = useState(hhmm(practice.end_time) || '12:00')

  const validate = () => {
    if (start && end && end <= start) {
      toast.error('เวลาสิ้นสุดต้องหลังเวลาเริ่ม')
      return false
    }
    return true
  }

  return (
    <div className="space-y-2">
      <TimeRangePicker
        startTime={start}
        endTime={end}
        onStartTimeChange={setStart}
        onEndTimeChange={setEnd}
        className="max-w-xs"
      />
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
          ยกเลิก
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => validate() && onSave(start, end, false)}
          disabled={busy}
        >
          บันทึกเวลา
        </Button>
        {practice.status === 'proposed' && (
          <Button
            size="sm"
            onClick={() => validate() && onSave(start, end, true)}
            disabled={busy}
            className="gap-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4" /> {busy ? 'กำลังบันทึก...' : 'บันทึก + อนุมัติ'}
          </Button>
        )}
      </div>
    </div>
  )
}
