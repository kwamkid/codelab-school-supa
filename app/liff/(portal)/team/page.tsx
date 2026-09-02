'use client'

// แท็บ "ทีม" ในแอปผู้ปกครอง — ยก /team (VEX team portal) มาไว้ที่เดียวกับตารางเรียน
// โผล่เฉพาะบ้านที่มีลูกอยู่ทีม (bottom nav ซ่อนแท็บนี้ให้เองถ้าไม่มี)
//
// ปฏิทินซ้อมใช้ `components/vex/practice-calendar.tsx` ตัวเดียวกับ /team
// (จิ้มเลือกหลายวันบนปฏิทิน → เสนอซ้อมทีเดียว) — หน้านี้แค่ต่อ API ให้
//
// เลย์เอาต์ตั้งใจไม่ใช้ Card: บนมือถือ card กิน margin นอก + padding ในอีกชั้น
// เลยเหลือที่ให้เนื้อหาน้อย. ใช้แถวเต็มความกว้างพื้นขาว คั่นด้วยเส้นบาง ๆ แทน

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiff } from '@/components/liff/liff-provider'
import { liffFetch } from '@/lib/line/liff-fetch'
import { getLiffCache, setLiffCache } from '@/lib/line/liff-cache'
import { Button } from '@/components/ui/button'
import { StudentChips } from '@/components/ui/student-badge'
import { Skeleton, SkeletonChips, SkeletonRows, } from '@/components/ui/skeleton'
import { LiffPageHeader } from '@/components/liff/page-header'
import { PracticeCalendar, type Practice } from '@/components/vex/practice-calendar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LEVEL_LABELS } from '@/lib/vex/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { openEventInCalendar, openPracticeInCalendar } from '@/lib/calendar-link'
import {
  BookOpen,
  FileCheck2,
  ExternalLink,
  Check,
  X,
  CalendarPlus,
  Copy,
  ClipboardCopy,
} from 'lucide-react'

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
    vrSkillsKey: string | null
    teammates: { id: string; nickname: string }[]
  }
  practices: Practice[]
  events: TeamEvent[]
}

const CACHE_KEY = 'team-data'
// ทุกทีมเข้าเว็บเดียวกัน ต่างกันที่รหัสทีม + Virtual Skills Key
const VEX_VR_URL = 'https://vr.vex.com'

function thaiDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * แถวรหัสที่กดคัดลอกได้ — แตะทั้งแถวได้เลย (นิ้วโป้งจิ้มง่ายกว่าปุ่มเล็ก ๆ)
 * ใช้กับหมายเลขทีม / Virtual Skills Key ที่ต้องเอาไปกรอกใน vr.vex.com
 */
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`คัดลอก${label}แล้ว`)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('คัดลอกไม่สำเร็จ')
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left active:bg-gray-50"
    >
      <span className="text-base text-gray-500 shrink-0">{label}</span>
      <span className="flex items-center gap-2 min-w-0">
        <span className="font-mono font-bold text-lg tracking-wider truncate">{value}</span>
        {copied ? (
          <Check className="h-5 w-5 text-green-600 shrink-0" />
        ) : (
          <Copy className="h-5 w-5 text-gray-400 shrink-0" />
        )}
      </span>
    </button>
  )
}

/** หัวข้อคั่นส่วน — เต็มความกว้าง พื้นเทา ไม่กินที่เหมือน CardHeader */
function SectionBar({ title }: { title: string }) {
  return (
    <div className="px-4 py-2 bg-gray-50 border-y border-gray-100">
      <h2 className="text-base font-semibold text-gray-700">{title}</h2>
    </div>
  )
}

export default function TeamPage() {
  const { liff, profile, isLoading: liffLoading } = useLiff()
  const cached = getLiffCache<{ members: Member[]; parentId: string | null }>(CACHE_KEY)

  const [members, setMembers] = useState<Member[]>(cached?.members ?? [])
  const [parentId, setParentId] = useState<string | null>(cached?.parentId ?? null)
  const [loading, setLoading] = useState(!cached)
  const [selectedKidId, setSelectedKidId] = useState<string>('')
  // แท็บในหน้าทีม — ตารางซ้อม / รายการแข่งขัน (ลิงก์ EN อยู่ท้ายหน้าทั้งสองแท็บ)
  const [tab, setTab] = useState<'practice' | 'events'>('practice')

  const load = useCallback(async () => {
    if (!profile?.userId) return
    try {
      const res = await liffFetch('/api/liff/team', { lineUserId: profile.userId, action: 'data' })
      if (res?.success) {
        setMembers(res.members || [])
        setParentId(res.parentId ?? null)
        setLiffCache(CACHE_KEY, { members: res.members || [], parentId: res.parentId ?? null })
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

  const call = useCallback(
    async (body: any) => {
      const res = await liffFetch('/api/liff/team', { lineUserId: profile?.userId, ...body })
      if (!res?.success) throw new Error(res?.error || 'ทำรายการไม่สำเร็จ')
      return res
    },
    [profile?.userId]
  )

  const submitPractice = useCallback(
    async (body: {
      kid_id: string
      practice_date: string
      start_time?: string
      end_time?: string
      note?: string
    }) => {
      const res = await call({
        action: 'practice.create',
        kidIds: [body.kid_id],
        dates: [body.practice_date],
        startTime: body.start_time,
        endTime: body.end_time,
        note: body.note,
      })
      return (res.practices || [])[0] as Practice
    },
    [call]
  )

  const editPractice = useCallback(
    async (
      id: string,
      body: { start_time?: string; end_time?: string; note?: string | null; practice_date?: string }
    ) => {
      const res = await call({
        action: 'practice.update',
        practiceId: id,
        date: body.practice_date,
        startTime: body.start_time,
        endTime: body.end_time,
        note: body.note,
      })
      return res.practice as Practice
    },
    [call]
  )

  const deletePractice = useCallback(
    async (id: string) => {
      await call({ action: 'practice.delete', practiceId: id })
    },
    [call]
  )

  // เลือกวิธีเปิดปฏิทินตามเครื่อง + เด้งออกเบราว์เซอร์ภายนอก → lib/calendar-link
  const addToCalendar = (e: TeamEvent) =>
    openEventInCalendar(liff, {
      id: e.id,
      name: e.name,
      dateStart: e.dateStart,
      dateEnd: e.dateEnd,
      place: e.place,
      details: member
        ? `ทีม ${member.team.teamNumber}${member.team.name ? ` — ${member.team.name}` : ''}`
        : undefined,
    })

  // วันซ้อมที่อนุมัติแล้ว — กดจากกล่องรายละเอียดในปฏิทิน
  const addPracticeToCalendar = (p: Practice, kidName: string) =>
    openPracticeInCalendar(liff, {
      id: p.id,
      date: p.practice_date,
      startTime: p.start_time,
      endTime: p.end_time,
      title: `ซ้อม VEX ทีม ${member?.team.teamNumber || ''}${kidName ? ` — ${kidName}` : ''}`.trim(),
      note: p.note,
    })

  // ผู้ปกครองไม่ได้เล่นเอง — ที่ต้องการคือ "ก๊อปข้อมูลไปส่งต่อ" ให้ลูก/ครู
  // เลยให้ปุ่มคัดลอกทั้งชุด (เว็บ + รหัสทีม + คีย์) เป็นข้อความพร้อมวางในแชท
  const copyVrAll = async () => {
    if (!member) return
    const lines = [
      'ฝึกเขียนโค้ด VEX VR',
      `เว็บ: ${VEX_VR_URL}`,
      `รหัสทีม: ${member.team.teamNumber}`,
      member.team.vrSkillsKey ? `Virtual Skills Key: ${member.team.vrSkillsKey}` : null,
    ].filter(Boolean)
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      toast.success('คัดลอกข้อมูลทั้งหมดแล้ว', { description: 'วางในแชทส่งต่อได้เลย' })
    } catch {
      toast.error('คัดลอกไม่สำเร็จ')
    }
  }

  const setRsvp = async (eventId: string, status: 'go' | 'no') => {
    if (!member) return
    // optimistic — แตะแล้วเปลี่ยนทันที ค่อย sync
    setMembers((prev) =>
      prev.map((m) =>
        m.kidId === member.kidId
          ? { ...m, events: m.events.map((e) => (e.id === eventId ? { ...e, rsvp: status } : e)) }
          : m
      )
    )
    try {
      await call({ action: 'rsvp', eventId, kidId: member.kidId, status })
    } catch (e: any) {
      toast.error(e?.message || 'บันทึกไม่สำเร็จ')
      load()
    }
  }

  // สลับแท็บมาแล้วยังไม่มีข้อมูล → วาดโครงหน้าไว้ก่อน (ไม่ใช่จอโหลดเปล่า ๆ)
  if (loading && members.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <LiffPageHeader title="ทีม" />
        <SkeletonChips />
        <div className="bg-white px-4 py-3 border-b border-gray-100 space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="px-4 py-2 bg-gray-50 border-y border-gray-100">
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="bg-white p-3">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <SkeletonRows count={2} />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LiffPageHeader title="ทีม" />
        <div className="p-8 text-center text-gray-500 text-base">ยังไม่มีข้อมูลทีม</div>
      </div>
    )
  }

  const t = member.team

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <LiffPageHeader title="ทีม" />

      {/* เลือกลูก — ชิปสีประจำตัวเด็ก (ตัวเดียวกับหน้าตารางเรียน) */}
      {members.length > 1 && (
        <StudentChips
          options={members.map((m) => ({ id: m.kidId, name: m.nickname }))}
          value={selectedKidId}
          onChange={setSelectedKidId}
          className="px-4 py-3 bg-white border-b border-gray-100"
        />
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

      {/* แท็บในหน้า — ตารางซ้อม / รายการแข่งขัน */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'practice' | 'events')}>
        <TabsList className="grid w-full grid-cols-2 rounded-none">
          <TabsTrigger value="practice">ตารางซ้อม</TabsTrigger>
          <TabsTrigger value="events">
            รายการแข่งขัน{member.events.length > 0 ? ` (${member.events.length})` : ''}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ปฏิทินซ้อม — คอมโพเนนต์เดียวกับ /team (จิ้มวันบนปฏิทินเพื่อเสนอซ้อม) */}
      {tab === 'practice' && (
        <div className="bg-white px-3 py-3">
        <PracticeCalendar
          key={t.id}
          kids={t.teammates}
          initialPractices={member.practices}
          viewerParentId={parentId}
          onSubmit={submitPractice}
          onEdit={editPractice}
          onDelete={deletePractice}
          onAddToCalendar={addPracticeToCalendar}
        />
        </div>
      )}

      {/* การแข่งขัน */}
      {tab === 'events' && (
        <div className="bg-white divide-y divide-gray-100">
          {member.events.length === 0 && (
            <p className="px-4 py-8 text-center text-base text-gray-400">
              ยังไม่มีรายการแข่งขันสำหรับระดับของทีมนี้
            </p>
          )}
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
                  variant={e.rsvp === 'go' ? 'default' : 'outline'}
                  onClick={() => setRsvp(e.id, 'go')}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-1" />
                  ไป
                </Button>
                <Button
                  variant={e.rsvp === 'no' ? 'destructive' : 'outline'}
                  onClick={() => setRsvp(e.id, 'no')}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-1" />
                  ไม่ไป
                </Button>
              </div>
              {e.rsvp === 'pend' && <p className="text-base text-amber-600 mt-1">ยังไม่ได้ตอบรับ</p>}
              {/* ตอบว่าไปแล้ว → กันลืม ด้วยการบันทึกลงปฏิทินมือถือ */}
              {e.rsvp === 'go' && (
                <Button variant="outline" onClick={() => addToCalendar(e)} className="w-full mt-2">
                  <CalendarPlus className="h-4 w-4 mr-1" />
                  บันทึกลงปฏิทิน
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ฝึกเขียนโค้ดบน VEX VR — ทุกทีมเข้าลิงก์เดียวกัน แล้วล็อกอินด้วย
          หมายเลขทีม + Virtual Skills Key ประจำทีม */}
      <SectionBar title="ฝึกเขียนโค้ด VEX VR" />
      <div className="bg-white divide-y divide-gray-100">
        <div className="px-4 py-3">
          <Button className="w-full" onClick={copyVrAll}>
            <ClipboardCopy className="h-4 w-4 mr-1" />
            คัดลอกข้อมูลทั้งหมด
          </Button>
          <p className="text-base text-gray-500 mt-2">
            ได้เป็นข้อความพร้อมส่งต่อในแชท — หรือแตะทีละแถวด้านล่างเพื่อคัดลอกเฉพาะอันนั้น
          </p>
        </div>
        <CopyRow label="เว็บ" value={VEX_VR_URL} />
        <CopyRow label="รหัสทีม" value={t.teamNumber} />
        {t.vrSkillsKey ? (
          <CopyRow label="Virtual Skills Key" value={t.vrSkillsKey} />
        ) : (
          <div className="px-4 py-3 text-base text-amber-600">
            ยังไม่มี Virtual Skills Key — ติดต่อครูผู้ดูแลทีม
            {t.coachName ? ` (ครู${t.coachName})` : ''}
          </div>
        )}
      </div>

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
    </div>
  )
}
