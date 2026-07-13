'use client'

// Event form dialog — used for BOTH create and edit.
//  - Create mode (no `event` prop): renders its own "สร้างกิจกรรม" trigger button.
//  - Edit mode (`event` provided + `open`/`onOpenChange` controlled): PATCHes the event.

import { useState, useRef, useEffect } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { CalendarPlus } from 'lucide-react'
import { LEVELS, type Level } from '@/lib/vex/types'
import { LevelBadge } from '@/components/vex/level-badge'

export interface EditableEvent {
  id: string
  name: string
  date_start: string | null
  date_end: string | null
  place: string | null
  has_world_spot: boolean
  levels: Level[]
}

interface Props {
  onSaved: () => void
  /** Present → edit mode. */
  event?: EditableEvent
  /** Controlled open state (edit mode). Omit for create mode. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreateEventForm({ onSaved, event, open: openProp, onOpenChange }: Props) {
  const isEdit = !!event
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isEdit ? !!openProp : internalOpen
  const setOpen = (v: boolean) => {
    if (isEdit) onOpenChange?.(v)
    else setInternalOpen(v)
  }

  const [name, setName] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [place, setPlace] = useState('')
  const [hasWorldSpot, setHasWorldSpot] = useState(false)
  const [levels, setLevels] = useState<Level[]>([])
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const toggleLevel = (lv: Level) =>
    setLevels((prev) => (prev.includes(lv) ? prev.filter((x) => x !== lv) : [...prev, lv]))

  const resetBlank = () => {
    setName('')
    setDateStart('')
    setDateEnd('')
    setPlace('')
    setHasWorldSpot(false)
    setLevels([])
  }

  // Seed the form from the event when the edit dialog opens.
  useEffect(() => {
    if (isEdit && open && event) {
      setName(event.name)
      setDateStart(event.date_start || '')
      setDateEnd(event.date_end || '')
      setPlace(event.place || '')
      setHasWorldSpot(event.has_world_spot)
      setLevels(event.levels || [])
    }
  }, [isEdit, open, event])

  const submit = async () => {
    if (submittingRef.current) return
    if (!name.trim()) return toast.error('กรุณากรอกชื่อกิจกรรม')
    if (levels.length === 0) return toast.error('เลือกอย่างน้อย 1 ระดับ')
    submittingRef.current = true
    setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        date_start: dateStart || (isEdit ? null : undefined),
        date_end: dateEnd || (isEdit ? null : undefined),
        place: place.trim() || (isEdit ? null : undefined),
        has_world_spot: hasWorldSpot,
        levels,
      }
      const res = await authFetch(
        isEdit ? `/api/admin/vex/events/${event!.id}` : '/api/admin/vex/events',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || (isEdit ? 'แก้ไขไม่สำเร็จ' : 'สร้างกิจกรรมไม่สำเร็จ'))
        return
      }
      toast.success(isEdit ? 'บันทึกการแก้ไขแล้ว' : 'สร้างกิจกรรมสำเร็จ')
      if (!isEdit) resetBlank()
      setOpen(false)
      onSaved()
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button>
            <CalendarPlus className="h-4 w-4 mr-2" /> สร้างกิจกรรม
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'แก้ไขกิจกรรม' : 'สร้างกิจกรรมการแข่งขัน'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ev_name">ชื่อกิจกรรม</Label>
            <Input id="ev_name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>วันจัดกิจกรรม</Label>
              <DateRangePicker
                mode="single"
                value={dateStart || undefined}
                onChange={(d) => {
                  setDateStart(d || '')
                  if (d && dateEnd && dateEnd < d) setDateEnd('')
                }}
                placeholder="เลือกวัน"
              />
            </div>
            <div className="space-y-2">
              <Label>วันสิ้นสุด (ไม่บังคับ)</Label>
              <DateRangePicker
                mode="single"
                value={dateEnd || undefined}
                onChange={(d) => setDateEnd(d || '')}
                placeholder="กิจกรรมวันเดียว — เว้นว่าง"
                minDate={dateStart ? new Date(dateStart + 'T00:00:00') : undefined}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev_place">สถานที่ (ไม่บังคับ)</Label>
            <Input id="ev_place" value={place} onChange={(e) => setPlace(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="ev_world"
              checked={hasWorldSpot}
              onCheckedChange={(c) => setHasWorldSpot(c === true)}
            />
            <Label htmlFor="ev_world" className="cursor-pointer">
              มีสิทธิ์ไปแข่ง World
            </Label>
          </div>
          <div className="space-y-2">
            <Label>ระดับที่เข้าร่วมได้ (เลือกได้หลายระดับ)</Label>
            <div className="grid grid-cols-1 gap-2">
              {LEVELS.map((lv) => (
                <label key={lv} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={levels.includes(lv)} onCheckedChange={() => toggleLevel(lv)} />
                  <LevelBadge level={lv} />
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'สร้างกิจกรรม'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
