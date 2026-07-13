'use client'

// Practice proposal UI: pick kid + date + optional start/end + note → submit.
// Below the form, list this parent's proposals with their status.

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarClock } from 'lucide-react'
import type { PracticeStatus } from '@/lib/vex/types'

interface Kid { id: string; nickname: string }
interface Practice {
  id: string
  kid_id: string
  practice_date: string
  start_time: string | null
  end_time: string | null
  note: string | null
  status: PracticeStatus
}

interface Props {
  kids: Kid[]
  initialPractices: Practice[]
  onSubmit: (body: {
    kid_id: string
    practice_date: string
    start_time?: string
    end_time?: string
    note?: string
  }) => Promise<Practice>
}

const STATUS_META: Record<PracticeStatus, { label: string; cls: string }> = {
  proposed: { label: 'รออนุมัติ', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'อนุมัติแล้ว', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'ไม่อนุมัติ', cls: 'bg-red-100 text-red-700' },
}

export function ProposePractice({ kids, initialPractices, onSubmit }: Props) {
  const [kidId, setKidId] = useState<string>(kids[0]?.id ?? '')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [note, setNote] = useState('')
  const [practices, setPractices] = useState<Practice[]>(initialPractices)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const kidName = (id: string) => kids.find((k) => k.id === id)?.nickname || '-'

  const submit = async () => {
    if (submittingRef.current) return
    if (!kidId) return toast.error('เลือกเด็ก')
    if (!date) return toast.error('เลือกวันที่ซ้อม')
    if (start && end && end <= start) return toast.error('เวลาสิ้นสุดต้องหลังเวลาเริ่ม')
    submittingRef.current = true
    setSubmitting(true)
    try {
      const created = await onSubmit({
        kid_id: kidId,
        practice_date: date,
        start_time: start || undefined,
        end_time: end || undefined,
        note: note.trim() || undefined,
      })
      setPractices((prev) => [created, ...prev])
      setDate('')
      setStart('')
      setEnd('')
      setNote('')
      toast.success('ส่งคำขอซ้อมแล้ว')
    } catch (e: any) {
      toast.error(e?.message || 'ส่งคำขอไม่สำเร็จ')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> เสนอวันซ้อม
          </h3>

          <div className="space-y-2">
            <Label>เด็ก</Label>
            <Select value={kidId} onValueChange={setKidId}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกเด็ก" />
              </SelectTrigger>
              <SelectContent>
                {kids.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.nickname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p_date">วันที่</Label>
            <Input id="p_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p_start">เวลาเริ่ม (ไม่บังคับ)</Label>
              <Input id="p_start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p_end">เวลาสิ้นสุด (ไม่บังคับ)</Label>
              <Input id="p_end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p_note">หมายเหตุ (ไม่บังคับ)</Label>
            <Input id="p_note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? 'กำลังส่ง...' : 'ส่งคำขอซ้อม'}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="font-semibold px-1">คำขอของฉัน ({practices.length})</h3>
        {practices.length === 0 ? (
          <p className="text-center text-gray-500 py-6 text-sm">ยังไม่มีคำขอซ้อม</p>
        ) : (
          practices.map((p) => {
            const meta = STATUS_META[p.status]
            return (
              <Card key={p.id}>
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{kidName(p.kid_id)}</div>
                    <div className="text-sm text-gray-600">
                      {p.practice_date}
                      {p.start_time ? ` ${p.start_time.slice(0, 5)}` : ''}
                      {p.end_time ? ` - ${p.end_time.slice(0, 5)}` : ''}
                    </div>
                    {p.note && <div className="text-xs text-gray-500 truncate">{p.note}</div>}
                  </div>
                  <Badge className={meta.cls}>{meta.label}</Badge>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
