'use client'

// Admin schedules a practice directly (no parent request, no approval round —
// rows are created APPROVED and parents get a "แอดมินนัดซ้อม" LINE noti).
//
// Kid picking is search-first over VEX kids ONLY (not the whole student body):
// type → pick → pick → pick, each selection becomes a removable chip. A team
// select adds the whole team in one go. Kids may span teams — the API stores
// each row under the kid's own team.

import { useEffect, useMemo, useRef, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { FormSelect, type FormSelectOption } from '@/components/ui/form-select'
import { TimeRangePicker } from '@/components/ui/time-range-picker'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { StudentBadge } from '@/components/ui/student-badge'
import { CalendarDays, Loader2, Plus, Search, X } from 'lucide-react'

interface VexKid {
  id: string
  nickname: string
  teamId: string
  teamNumber: string
}

export function AddPracticeDialog({
  branchId,
  onCreated,
}: {
  branchId?: string | null
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [kids, setKids] = useState<VexKid[]>([])
  const [teamOptions, setTeamOptions] = useState<FormSelectOption[]>([])
  const [selected, setSelected] = useState<Map<string, VexKid>>(new Map())
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [dates, setDates] = useState<Date[]>([])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Load VEX teams + kids once per open (branch-scoped like the page).
  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const res = await authFetch('/api/admin/vex/teams')
        const data = await res.json()
        if (!res.ok) return
        const teams = (data.teams || []).filter((t: any) => !branchId || t.branch_id === branchId)
        setTeamOptions(
          teams.map((t: any) => ({ value: t.id, label: `${t.team_number}${t.name ? ` — ${t.name}` : ''}` }))
        )
        setKids(
          teams.flatMap((t: any) =>
            (t.kids || []).map((k: any) => ({
              id: k.id, nickname: k.nickname, teamId: t.id, teamNumber: t.team_number,
            }))
          )
        )
      } catch {
        toast.error('โหลดทีมไม่สำเร็จ')
      }
    })()
  }, [open, branchId])

  // Close the result list when clicking outside the search box.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setShowResults(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = kids.filter((k) => !selected.has(k.id))
    const hits = q ? pool.filter((k) => k.nickname.toLowerCase().includes(q)) : pool
    return hits.slice(0, 8)
  }, [kids, query, selected])

  const addKid = (k: VexKid) => {
    setSelected((prev) => new Map(prev).set(k.id, k))
    // Clear for the next search; the full list stays open for เลือกๆๆๆ
    setQuery('')
  }
  const removeKid = (id: string) => {
    setSelected((prev) => { const n = new Map(prev); n.delete(id); return n })
  }
  const addTeam = (teamId: string) => {
    setSelected((prev) => {
      const n = new Map(prev)
      kids.filter((k) => k.teamId === teamId).forEach((k) => n.set(k.id, k))
      return n
    })
  }

  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const reset = () => {
    setSelected(new Map()); setQuery(''); setDates([]); setStartTime(''); setEndTime(''); setNote('')
  }

  const submit = async () => {
    if (selected.size === 0 || dates.length === 0 || !startTime || !endTime) {
      toast.error('กรุณาเลือกเด็ก วันที่ และเวลาให้ครบ')
      return
    }
    try {
      setSaving(true)
      const res = await authFetch('/api/admin/vex/practices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kid_ids: [...selected.keys()],
          practice_dates: dates.map(toDateStr).sort(),
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>เพิ่มการซ้อม</DialogTitle>
            <DialogDescription>
              แอดมินนัดวันซ้อมโดยตรง — อนุมัติทันที และแจ้งผู้ปกครองทาง LINE
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Kid search (VEX kids only) + whole-team quick add */}
            <div className="space-y-2">
              <Label>เลือกเด็ก (พิมพ์ค้นหา เลือกได้หลายคน)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="relative" ref={searchRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setShowResults(true) }}
                    onFocus={() => setShowResults(true)}
                    placeholder="ชื่อเด็กในทีม VEX..."
                    className="pl-9"
                  />
                  {showResults && results.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-56 overflow-auto">
                      {results.map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50"
                          onClick={() => addKid(k)}
                        >
                          <StudentBadge name={k.nickname} />
                          <span className="text-xs text-gray-500 shrink-0">{k.teamNumber}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <FormSelect
                  options={teamOptions}
                  value=""
                  onValueChange={addTeam}
                  placeholder="หรือเลือกทั้งทีม..."
                  searchPlaceholder="ค้นหาทีม..."
                />
              </div>

              {/* Selected chips */}
              {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-gray-50/60 p-2">
                  {[...selected.values()].map((k) => (
                    <span key={k.id} className="inline-flex items-center gap-1">
                      <StudentBadge name={k.nickname} />
                      <button
                        type="button"
                        onClick={() => removeKid(k.id)}
                        className="text-gray-400 hover:text-red-600"
                        aria-label={`เอา ${k.nickname} ออก`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    className="ml-auto text-xs text-gray-500 hover:text-red-600 shrink-0"
                    onClick={() => setSelected(new Map())}
                  >
                    ล้างทั้งหมด ({selected.size})
                  </button>
                </div>
              )}
            </div>

            {/* Dates (multi-select calendar) + time on one row (stacks on mobile) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>วันที่ซ้อม (เลือกได้หลายวัน)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                      <CalendarDays className="h-4 w-4 mr-2 text-gray-500" />
                      {dates.length === 0
                        ? 'เลือกวันที่...'
                        : `เลือกแล้ว ${dates.length} วัน`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="multiple"
                      selected={dates}
                      onSelect={(d) => setDates(d || [])}
                      disabled={{ before: new Date() }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>เวลา (ทุกวันที่เลือก)</Label>
                <TimeRangePicker
                  startTime={startTime}
                  endTime={endTime}
                  onStartTimeChange={setStartTime}
                  onEndTimeChange={setEndTime}
                />
              </div>
            </div>

            {/* Chosen dates as removable chips */}
            {dates.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {[...dates].sort((a, b) => a.getTime() - b.getTime()).map((d) => (
                  <span
                    key={d.toISOString()}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-sm"
                  >
                    {d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}
                    <button
                      type="button"
                      onClick={() => setDates(dates.filter((x) => x.getTime() !== d.getTime()))}
                      className="opacity-60 hover:opacity-100"
                      aria-label="เอาวันนี้ออก"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>หมายเหตุ (ไม่บังคับ)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ซ้อมก่อนแข่ง" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>ยกเลิก</Button>
              <Button onClick={submit} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                เพิ่มการซ้อม ({selected.size})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
