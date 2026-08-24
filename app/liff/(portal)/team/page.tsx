'use client'

// แท็บ "ทีม" ในแอปผู้ปกครอง — ยก /team (VEX team portal) มาไว้ที่เดียวกับตารางเรียน
// โผล่เฉพาะบ้านที่มีลูกอยู่ทีม (bottom nav ซ่อนแท็บนี้ให้เองถ้าไม่มี)
//
// เลย์เอาต์ตั้งใจไม่ใช้ Card: บนมือถือ card กิน margin รอบนอก + padding ในอีกชั้น
// เลยเหลือที่ให้เนื้อหาน้อย. ใช้แถวเต็มความกว้างพื้นขาว คั่นด้วยเส้นบาง ๆ แทน

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiff } from '@/components/liff/liff-provider'
import { liffFetch } from '@/lib/line/liff-fetch'
import { getLiffCache, setLiffCache } from '@/lib/line/liff-cache'
import { PageLoading } from '@/components/ui/loading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { TimeRangePicker } from '@/components/ui/time-range-picker'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LEVEL_LABELS } from '@/lib/vex/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Plus,
  Trophy,
  BookOpen,
  FileCheck2,
  ExternalLink,
  Pencil,
  Trash2,
  Check,
  X,
  Clock,
  Loader2,
} from 'lucide-react'

interface Practice {
  id: string
  date: string
  startTime: string | null
  endTime: string | null
  note: string | null
  status: 'proposed' | 'approved' | 'rejected'
  rejectReason: string | null
  kidId: string
  kidNickname: string
  isMine: boolean
  canEdit: boolean
}

interface TeamEvent {
  id: string
  name: string
  dateStart: string
  dateEnd: string | null
  place: string | null
  hasWorldSpot: boolean
  rsvp: 'pend' | 'go' | 'no'
}

interface Member {
  studentId: string
  kidId: string
  nickname: string
  name: string
  team: {
    id: string
    teamNumber: string
    name: string | null
    level: string
    coachName: string | null
    coachImage: string | null
    notebookUrl: string | null
    notebookSubmitUrl: string | null
    teammates: { id: string; nickname: string }[]
  }
  practices: Practice[]
  events: TeamEvent[]
}

const CACHE_KEY = 'team-data'
const todayStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })

function thaiDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function timeText(p: { startTime: string | null; endTime: string | null }) {
  if (!p.startTime) return 'ยังไม่ระบุเวลา'
  const cut = (t: string) => t.slice(0, 5)
  return p.endTime ? `${cut(p.startTime)} - ${cut(p.endTime)}` : cut(p.startTime)
}

const STATUS_META: Record<Practice['status'], { label: string; className: string }> = {
  approved: { label: 'อนุมัติแล้ว', className: 'text-green-700 bg-green-50' },
  proposed: { label: 'รออนุมัติ', className: 'text-amber-700 bg-amber-50' },
  rejected: { label: 'ไม่อนุมัติ', className: 'text-red-700 bg-red-50' },
}

/** หัวข้อคั่นส่วน — เต็มความกว้าง พื้นเทา ไม่กินที่เหมือน CardHeader */
function SectionBar({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-y border-gray-100">
      <h2 className="text-base font-semibold text-gray-700">{title}</h2>
      {action}
    </div>
  )
}

export default function TeamPage() {
  const { profile, isLoading: liffLoading } = useLiff()
  const cached = getLiffCache<{ members: Member[] }>(CACHE_KEY)

  const [members, setMembers] = useState<Member[]>(cached?.members ?? [])
  const [loading, setLoading] = useState(!cached)
  const [selectedKidId, setSelectedKidId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // ฟอร์มขอวันซ้อม / แก้คำขอ
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Practice | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [note, setNote] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Practice | null>(null)

  const load = useCallback(async () => {
    if (!profile?.userId) return
    try {
      const res = await liffFetch('/api/liff/team', { lineUserId: profile.userId, action: 'data' })
      if (res?.success) {
        setMembers(res.members || [])
        setLiffCache(CACHE_KEY, { members: res.members || [] })
      }
    } catch (e) {
      console.error('[team] load failed', e)
    } finally {
      setLoading(false)
    }
  }, [profile?.userId])

  useEffect(() => {
    if (!liffLoading) load()
  }, [liffLoading, load])

  useEffect(() => {
    if (!selectedKidId && members.length > 0) setSelectedKidId(members[0].kidId)
  }, [members, selectedKidId])

  const member = useMemo(
    () => members.find((m) => m.kidId === selectedKidId) || members[0],
    [members, selectedKidId]
  )

  const { upcoming, past } = useMemo(() => {
    const today = todayStr()
    const list = member?.practices || []
    return {
      upcoming: list.filter((p) => p.date >= today),
      past: list.filter((p) => p.date < today).reverse(),
    }
  }, [member])

  const openCreate = () => {
    setEditing(null)
    setDates([])
    setStartTime('')
    setEndTime('')
    setNote('')
    setFormOpen(true)
  }

  const openEdit = (p: Practice) => {
    setEditing(p)
    setDates([p.date])
    setStartTime(p.startTime?.slice(0, 5) || '')
    setEndTime(p.endTime?.slice(0, 5) || '')
    setNote(p.note || '')
    setFormOpen(true)
  }

  const submit = async () => {
    if (!profile?.userId || !member) return
    if (dates.length === 0) {
      toast.error('เลือกวันซ้อมอย่างน้อย 1 วัน')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await liffFetch('/api/liff/team', {
          lineUserId: profile.userId,
          action: 'practice.update',
          practiceId: editing.id,
          date: dates[0],
          startTime,
          endTime,
          note,
        })
        toast.success('แก้ไขคำขอแล้ว')
      } else {
        const res = await liffFetch('/api/liff/team', {
          lineUserId: profile.userId,
          action: 'practice.create',
          kidId: member.kidId,
          dates,
          startTime,
          endTime,
          note,
        })
        toast.success(`ส่งคำขอซ้อม ${res?.created || dates.length} วันแล้ว`, {
          description: 'รอแอดมินอนุมัติ จะแจ้งกลับทาง LINE',
        })
      }
      setFormOpen(false)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!profile?.userId || !deleteTarget) return
    setSaving(true)
    try {
      await liffFetch('/api/liff/team', {
        lineUserId: profile.userId,
        action: 'practice.delete',
        practiceId: deleteTarget.id,
      })
      toast.success('ลบคำขอแล้ว')
      setDeleteTarget(null)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'ลบไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const setRsvp = async (eventId: string, status: 'go' | 'no') => {
    if (!profile?.userId || !member) return
    // optimistic — แตะแล้วเปลี่ยนทันที ค่อย sync
    setMembers((prev) =>
      prev.map((m) =>
        m.kidId === member.kidId
          ? { ...m, events: m.events.map((e) => (e.id === eventId ? { ...e, rsvp: status } : e)) }
          : m
      )
    )
    try {
      await liffFetch('/api/liff/team', {
        lineUserId: profile.userId,
        action: 'rsvp',
        eventId,
        kidId: member.kidId,
        status,
      })
    } catch (e: any) {
      toast.error(e?.message || 'บันทึกไม่สำเร็จ')
      load()
    }
  }

  if (loading && members.length === 0) return <PageLoading />

  if (!member) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-primary text-white p-4 pt-6">
          <h1 className="text-xl font-bold">ทีม</h1>
        </div>
        <div className="p-8 text-center text-gray-500 text-base">ยังไม่มีข้อมูลทีม</div>
      </div>
    )
  }

  const t = member.team

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-primary text-white p-4 pt-6">
        <h1 className="text-xl font-bold">ทีม</h1>
      </div>

      {/* เลือกลูก — โผล่เฉพาะบ้านที่มีลูกอยู่ทีมมากกว่า 1 คน */}
      {members.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3 bg-white border-b border-gray-100">
          {members.map((m) => (
            <button
              key={m.kidId}
              type="button"
              onClick={() => setSelectedKidId(m.kidId)}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-base transition-colors',
                m.kidId === selectedKidId
                  ? 'bg-primary text-white font-medium'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              {m.nickname}
            </button>
          ))}
        </div>
      )}

      {/* ชื่อทีม — แถวเดียวจบ ไม่ต้องมีกรอบ */}
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{t.teamNumber}</span>
          {t.name && <span className="text-lg text-gray-700">{t.name}</span>}
        </div>
        <p className="text-base text-gray-500 mt-0.5">
          {LEVEL_LABELS[t.level as keyof typeof LEVEL_LABELS] || t.level}
          {t.coachName && ` · ครู${t.coachName}`}
        </p>
        {t.teammates.length > 0 && (
          <p className="text-base text-gray-400 mt-0.5">
            สมาชิก: {t.teammates.map((k) => k.nickname).join(', ')}
          </p>
        )}
      </div>

      {/* ตารางซ้อม */}
      <SectionBar
        title="ตารางซ้อม"
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            ขอวันซ้อม
          </Button>
        }
      />

      <div className="bg-white divide-y divide-gray-100">
        {upcoming.length === 0 && (
          <p className="px-4 py-6 text-center text-base text-gray-400">
            ยังไม่มีวันซ้อมที่จะถึง — กด &quot;ขอวันซ้อม&quot; เพื่อเสนอวัน
          </p>
        )}
        {upcoming.map((p) => (
          <div key={p.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-medium">
                  {thaiDate(p.date)} · {timeText(p)}
                </p>
                <p className="text-base text-gray-500">
                  {p.kidNickname}
                  {p.note ? ` · ${p.note}` : ''}
                </p>
                {p.status === 'rejected' && p.rejectReason && (
                  <p className="text-base text-red-600 mt-0.5">เหตุผล: {p.rejectReason}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-sm whitespace-nowrap',
                    STATUS_META[p.status].className
                  )}
                >
                  {STATUS_META[p.status].label}
                </span>
              </div>
            </div>
            {p.canEdit && (
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                  <Pencil className="h-4 w-4 mr-1" />
                  แก้ไข
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDeleteTarget(p)}>
                  <Trash2 className="h-4 w-4 mr-1 text-red-500" />
                  ลบ
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {past.length > 0 && (
        <>
          <SectionBar title="ซ้อมที่ผ่านมา" />
          <div className="bg-white divide-y divide-gray-100">
            {past.slice(0, 10).map((p) => (
              <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <p className="text-base text-gray-500">
                  {thaiDate(p.date)} · {timeText(p)} · {p.kidNickname}
                </p>
                <span className={cn('rounded-full px-2 py-0.5 text-sm', STATUS_META[p.status].className)}>
                  {STATUS_META[p.status].label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* การแข่งขัน */}
      {member.events.length > 0 && (
        <>
          <SectionBar title="รายการแข่งขัน" />
          <div className="bg-white divide-y divide-gray-100">
            {member.events.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <p className="text-base font-medium">{e.name}</p>
                <p className="text-base text-gray-500">
                  {thaiDate(e.dateStart)}
                  {e.dateEnd && e.dateEnd !== e.dateStart ? ` - ${thaiDate(e.dateEnd)}` : ''}
                  {e.place ? ` · ${e.place}` : ''}
                </p>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant={e.rsvp === 'go' ? 'default' : 'outline'}
                    onClick={() => setRsvp(e.id, 'go')}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    ไป
                  </Button>
                  <Button
                    size="sm"
                    variant={e.rsvp === 'no' ? 'destructive' : 'outline'}
                    onClick={() => setRsvp(e.id, 'no')}
                  >
                    <X className="h-4 w-4 mr-1" />
                    ไม่ไป
                  </Button>
                  {e.rsvp === 'pend' && (
                    <span className="self-center text-base text-amber-600">ยังไม่ได้ตอบ</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Engineering Notebook */}
      {(t.notebookUrl || t.notebookSubmitUrl) && (
        <>
          <SectionBar title="Engineering Notebook" />
          <div className="bg-white divide-y divide-gray-100">
            {t.notebookUrl && (
              <a
                href={t.notebookUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-3 text-base text-blue-600"
              >
                <BookOpen className="h-4 w-4" />
                เล่มที่กำลังทำ
                <ExternalLink className="h-4 w-4 ml-auto text-gray-300" />
              </a>
            )}
            {t.notebookSubmitUrl && (
              <a
                href={t.notebookSubmitUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-3 text-base text-green-700"
              >
                <FileCheck2 className="h-4 w-4" />
                ฉบับส่ง (PDF)
                <ExternalLink className="h-4 w-4 ml-auto text-gray-300" />
              </a>
            )}
          </div>
        </>
      )}

      {/* ฟอร์มขอ/แก้วันซ้อม */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              {editing ? 'แก้ไขคำขอซ้อม' : 'ขอวันซ้อม'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-base text-gray-600">
                {editing ? 'วันที่' : 'เลือกวัน (เลือกได้หลายวัน)'}
              </p>
              <DateRangePicker
                mode="multiple"
                values={dates}
                onChange={(v) => setDates(editing ? v.slice(-1) : v)}
                minDate={new Date()}
                placeholder="แตะเพื่อเลือกวัน"
              />
            </div>

            <div className="space-y-1">
              <p className="text-base text-gray-600">เวลา (ไม่ระบุก็ได้)</p>
              <TimeRangePicker
                startTime={startTime}
                endTime={endTime}
                onStartTimeChange={setStartTime}
                onEndTimeChange={setEndTime}
              />
            </div>

            <div className="space-y-1">
              <p className="text-base text-gray-600">หมายเหตุ</p>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น มาสายนิดหน่อย"
                className="text-base"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              ปิด
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'บันทึก' : 'ส่งคำขอ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ยืนยันลบคำขอ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[320px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              ลบคำขอซ้อม
            </AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-base text-gray-600">
            {deleteTarget && `${thaiDate(deleteTarget.date)} · ${timeText(deleteTarget)}`}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>ปิด</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              ลบคำขอ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
