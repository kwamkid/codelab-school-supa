'use client'

// Admin schedules a practice directly (no parent request, no approval round —
// rows are created APPROVED and parents get a "แอดมินนัดซ้อม" LINE noti).
// Pick team → kids (all pre-checked) → date + time → save.

import { useEffect, useMemo, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { FormSelect, type FormSelectOption } from '@/components/ui/form-select'
import { TimeRangePicker } from '@/components/ui/time-range-picker'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { StudentBadge } from '@/components/ui/student-badge'
import { Loader2, Plus } from 'lucide-react'

interface TeamWithKids {
  id: string
  team_number: string
  name: string | null
  branch_id?: string | null
  kids: { id: string; nickname: string }[]
}

export function AddPracticeDialog({
  branchId,
  defaultTeamId,
  onCreated,
}: {
  branchId?: string | null
  defaultTeamId?: string
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [teams, setTeams] = useState<TeamWithKids[]>([])
  const [teamId, setTeamId] = useState('')
  const [selectedKids, setSelectedKids] = useState<Set<string>>(new Set())
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Load teams (with kids) when the dialog opens.
  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const res = await authFetch('/api/admin/vex/teams')
        const data = await res.json()
        if (res.ok) {
          const list: TeamWithKids[] = (data.teams || []).filter(
            (t: TeamWithKids) => !branchId || t.branch_id === branchId
          )
          setTeams(list)
          const initial = defaultTeamId && list.some((t) => t.id === defaultTeamId)
            ? defaultTeamId
            : ''
          if (initial) selectTeam(initial, list)
        }
      } catch {
        toast.error('โหลดทีมไม่สำเร็จ')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, branchId, defaultTeamId])

  const selectTeam = (id: string, list?: TeamWithKids[]) => {
    setTeamId(id)
    const team = (list || teams).find((t) => t.id === id)
    // Whole-team practice is the common case → pre-check everyone.
    setSelectedKids(new Set(team?.kids.map((k) => k.id) || []))
  }

  const team = teams.find((t) => t.id === teamId)
  const teamOptions = useMemo<FormSelectOption[]>(
    () => teams.map((t) => ({ value: t.id, label: `${t.team_number}${t.name ? ` — ${t.name}` : ''}` })),
    [teams]
  )

  const toggleKid = (id: string) => {
    setSelectedKids((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const reset = () => {
    setTeamId(''); setSelectedKids(new Set()); setDate(''); setStartTime(''); setEndTime(''); setNote('')
  }

  const submit = async () => {
    if (!teamId || selectedKids.size === 0 || !date || !startTime || !endTime) {
      toast.error('กรุณาเลือกทีม เด็ก วันที่ และเวลาให้ครบ')
      return
    }
    try {
      setSaving(true)
      const res = await authFetch('/api/admin/vex/practices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          kid_ids: [...selectedKids],
          practice_date: date,
          start_time: startTime,
          end_time: endTime,
          note: note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'เพิ่มการซ้อมไม่สำเร็จ')
        return
      }
      toast.success(
        `เพิ่มการซ้อมแล้ว ${data.created} คน` +
        (data.skipped ? ` (ข้าม ${data.skipped} คนที่มีซ้อมวันนั้นอยู่แล้ว)` : '')
      )
      setOpen(false)
      reset()
      onCreated()
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Page-header primary action, same shape as สร้าง Makeup / สร้างทีม */}
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        เพิ่มการซ้อม
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มการซ้อม</DialogTitle>
            <DialogDescription>
              แอดมินนัดวันซ้อมให้ทีมโดยตรง — อนุมัติทันที และแจ้งผู้ปกครองทาง LINE
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ทีม</Label>
              <FormSelect
                options={teamOptions}
                value={teamId}
                onValueChange={(v) => selectTeam(v)}
                placeholder="เลือกทีม"
                searchPlaceholder="ค้นหาทีม..."
              />
            </div>

            {team && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>สมาชิกที่มาซ้อม ({selectedKids.size}/{team.kids.length})</Label>
                  <button
                    type="button"
                    className="text-xs text-primary font-medium"
                    onClick={() =>
                      setSelectedKids(
                        selectedKids.size === team.kids.length
                          ? new Set()
                          : new Set(team.kids.map((k) => k.id))
                      )
                    }
                  >
                    {selectedKids.size === team.kids.length ? 'เอาออกทั้งหมด' : 'เลือกทั้งหมด'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {team.kids.length === 0 && (
                    <p className="text-sm text-gray-400">ทีมนี้ยังไม่มีสมาชิก</p>
                  )}
                  {team.kids.map((k) => (
                    <label key={k.id} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={selectedKids.has(k.id)}
                        onCheckedChange={() => toggleKid(k.id)}
                      />
                      <StudentBadge name={k.nickname} />
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>วันที่ซ้อม</Label>
              <DateRangePicker mode="single" value={date} onChange={(d) => setDate(d || '')} placeholder="เลือกวันที่" />
            </div>

            <div className="space-y-2">
              <Label>เวลา</Label>
              <TimeRangePicker
                startTime={startTime}
                endTime={endTime}
                onStartTimeChange={setStartTime}
                onEndTimeChange={setEndTime}
              />
            </div>

            <div className="space-y-2">
              <Label>หมายเหตุ (ไม่บังคับ)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ซ้อมก่อนแข่ง" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>ยกเลิก</Button>
              <Button onClick={submit} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                เพิ่มการซ้อม
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
