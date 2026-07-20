'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StudentBadge } from '@/components/ui/student-badge'
import {
  CalendarOff, Calendar, MessageSquare, ChevronRight,
  UserPlus, User, Image as ImageIcon, Loader2,
} from 'lucide-react'
import { useLiff } from '@/components/liff/liff-provider'
import { liffFetch } from '@/lib/line/liff-fetch'
import { getLiffCache, setLiffCache } from '@/lib/line/liff-cache'
import { Loading } from '@/components/ui/loading'
import { formatDate, getDayName } from '@/lib/utils'
import { toast } from 'sonner'

interface NextClass {
  className: string; subjectName: string; subjectColor?: string | null
  sessionNumber: number
  totalSessions?: number
  sessionDate: string; startTime: string; endTime: string
  branchName: string; studentName: string
}

interface HomeSummary {
  hasParent: boolean
  parentName: string
  pendingMakeupCount: number
  // One upcoming class per student; nextClass kept for cached old payloads.
  nextClasses?: NextClass[]
  nextClass: NextClass | null
  latestFeedback: null | {
    studentName: string; className: string; subjectName?: string
    subjectColor?: string | null; sessionNumber: number
    sessionDate: string; feedback: string; photoCount: number
  }
}

function Dashboard() {
  const router = useRouter()
  const { liff, profile, isLoading: liffLoading } = useLiff()
  const cacheKey = profile?.userId ? `home:${profile.userId}` : null
  const cached = cacheKey ? getLiffCache<HomeSummary>(cacheKey) : undefined
  const [loading, setLoading] = useState(!cached)
  const [data, setData] = useState<HomeSummary | null>(cached ?? null)
  const [goingProfile, setGoingProfile] = useState(false)

  // token คำเชิญ "ผู้รับการแจ้งเตือนเพิ่มเติม" จากลิงก์เชิญ — อ่านครั้งเดียวตอน mount
  // (บางเคส LIFF ห่อ query ไว้ใน liff.state)
  const [inviteToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    let token = params.get('recipientInvite')
    if (!token) {
      const state = params.get('liff.state')
      if (state) token = new URLSearchParams(state.replace(/^\?/, '')).get('recipientInvite')
    }
    return token
  })
  // มีคำเชิญ → ต้องตอบรับให้เสร็จก่อนค่อยโหลดข้อมูล ไม่งั้นหน้าจะโหลดแข่งกันแล้ว
  // แว้บเป็น "ยังไม่ได้ลงทะเบียน" ทั้งที่ตอบรับสำเร็จ (ต้อง refresh ถึงเห็นข้อมูลลูก)
  const [invitePending, setInvitePending] = useState<boolean>(() => !!inviteToken)

  // ตอบรับคำเชิญ — ผู้กดลิงก์คือผู้รับใหม่ ทำงานได้แม้ยังไม่ลงทะเบียนเป็นผู้ปกครองเอง
  useEffect(() => {
    if (!inviteToken || liffLoading || !profile?.userId) return
    ;(async () => {
      try {
        const res = await liffFetch('/api/liff/recipients', {
          lineUserId: profile.userId,
          action: 'accept',
          token: inviteToken,
          displayName: profile.displayName,
          pictureUrl: (profile as any).pictureUrl,
        })
        // กดลิงก์เดิมซ้ำ (ตอบรับไปแล้ว) = ผปค.ใช้ลิงก์เป็นทางเข้าแอป — พาเข้าหน้า
        // ข้อมูลลูกเงียบ ๆ ไม่ต้องเด้งข้อความเหมือนทำอะไรผิด
        if (!res?.alreadyAccepted) {
          toast.success('🎉 ตอบรับสำเร็จ! การแจ้งเตือนของบุตรหลานจะส่งมาที่ LINE นี้ด้วย', { duration: 6000 })
        }
      } catch (e: any) {
        toast.error(e?.message || 'ตอบรับคำเชิญไม่สำเร็จ', { duration: 6000 })
      } finally {
        const url = new URL(window.location.href)
        url.searchParams.delete('recipientInvite')
        window.history.replaceState({}, '', url.toString())
        setInvitePending(false) // ปลดล็อกให้ effect โหลดข้อมูลทำงาน (เห็นข้อมูลลูกทันที ไม่ต้อง refresh)
      }
    })()
    // ยิงครั้งเดียวต่อ token — profile.userId นิ่งแล้วตอน liffLoading จบ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken, liffLoading, profile?.userId])

  useEffect(() => {
    if (liffLoading || !profile?.userId || invitePending) return
    let active = true
    ;(async () => {
      try {
        const res = await liffFetch<HomeSummary & { success: boolean }>('/api/liff/home', {
          lineUserId: profile.userId,
        })
        if (active) {
          setData(res)
          if (cacheKey) setLiffCache(cacheKey, res)
        }
      } catch (e) {
        console.error('[dashboard] load error', e)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [liffLoading, profile?.userId, invitePending])

  // ยังไม่ได้เพิ่มเพื่อน OA → LINE push ไม่ถึง — ชวนเพิ่มเพื่อน (โดยเฉพาะ account รอง
  // ที่เข้ามาจากลิงก์เชิญ ยังไม่เคยแอด OA และไม่มี rich menu เป็นทางเข้า)
  const [addFriendUrl, setAddFriendUrl] = useState<string | null>(null)
  useEffect(() => {
    if (liffLoading || invitePending || !data?.hasParent || !liff) return
    let active = true
    ;(async () => {
      try {
        const friendship = await (liff as any).getFriendship?.()
        if (!friendship || friendship.friendFlag) return
        const res = await fetch('/api/liff/oa-info')
        const info = await res.json().catch(() => null)
        if (active && info?.success && info.addFriendUrl) setAddFriendUrl(info.addFriendUrl)
      } catch {
        // getFriendship ใช้ได้เฉพาะเมื่อ channel ผูกกับ OA — ถ้าไม่ได้ก็ข้าม ไม่ต้องเด้งอะไร
      }
    })()
    return () => { active = false }
  }, [liffLoading, invitePending, data?.hasParent, liff])

  if (liffLoading || loading || invitePending) return <Loading fullScreen size="lg" />

  // Logged in but not registered yet
  if (data && data.hasParent === false) {
    return (
      <div className="p-4 pt-10 max-w-md mx-auto">
        <Card className="border-2 border-orange-200">
          <CardContent className="pt-6 space-y-4 text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
              <UserPlus className="h-10 w-10 text-orange-600" />
            </div>
            <h2 className="text-xl font-bold">ยังไม่ได้ลงทะเบียน</h2>
            <p className="text-gray-600 text-sm">กรุณาลงทะเบียนเพื่อเริ่มใช้งาน</p>
            <Button className="w-full" size="lg" onClick={() => router.push('/liff/register')}>
              <UserPlus className="h-5 w-5 mr-2" /> ลงทะเบียนใหม่
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const firstName = (profile?.displayName || data?.parentName || '').trim()

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-orange-500 text-white px-5 pt-7 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm">สวัสดีค่ะ 👋</p>
            <h1 className="text-xl font-bold">{firstName || 'ผู้ปกครอง'}</h1>
          </div>
          <button
            onClick={() => { setGoingProfile(true); router.push('/liff/profile') }}
            disabled={goingProfile}
            className="w-11 h-11 rounded-full bg-white/20 backdrop-blur flex items-center justify-center overflow-hidden border border-white/30 active:scale-95 transition-transform"
          >
            {goingProfile ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : profile?.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.pictureUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ยังไม่ได้เพิ่มเพื่อน OA → แจ้งเตือนทาง LINE จะส่งไม่ถึง */}
        {addFriendUrl && (
          <Card className="border-2 border-green-300 bg-green-50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-500 text-white shrink-0">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">เพิ่มเพื่อน CodeLab School</p>
                <p className="text-sm text-gray-600">เพื่อรับการแจ้งเตือนตารางเรียนทาง LINE</p>
              </div>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 shrink-0"
                onClick={() => {
                  if (liff?.openWindow) liff.openWindow({ url: addFriendUrl, external: true })
                  else window.open(addFriendUrl, '_blank')
                }}
              >
                เพิ่มเพื่อน
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Makeup alert */}
        {data && data.pendingMakeupCount > 0 && (
          <Card
            className="cursor-pointer border-2 border-orange-300 bg-orange-50 active:scale-[0.98] transition-transform"
            onClick={() => router.push('/liff/makeup')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="p-3 rounded-xl bg-orange-500 text-white">
                  <CalendarOff className="h-6 w-6" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center border-2 border-white">
                  {data.pendingMakeupCount}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-orange-900">ต้องเรียนชดเชย {data.pendingMakeupCount} ครั้ง</h3>
                <p className="text-sm text-orange-700">ยังรอนัดวันเรียนชดเชย</p>
              </div>
              <ChevronRight className="h-5 w-5 text-orange-400" />
            </CardContent>
          </Card>
        )}

        {/* Next class — one card per student */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-2 px-1">คาบเรียนถัดไป</h2>
          {(() => {
            const nextClasses = data?.nextClasses?.length
              ? data.nextClasses
              : data?.nextClass ? [data.nextClass] : []
            if (nextClasses.length === 0) {
              return <Card><CardContent className="p-4 text-center text-sm text-gray-400">ไม่มีคาบเรียนที่กำลังจะถึง</CardContent></Card>
            }
            return (
              <div className="space-y-2">
                {nextClasses.map((nc, i) => (
                  <Card key={`${nc.studentName}-${i}`} className="cursor-pointer active:scale-[0.98] transition-transform" onClick={() => router.push('/liff/schedule')}>
                    <CardContent className="p-3">
                      {/* Subject color dot — same treatment as the schedule tab */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-4 h-4 rounded-full shrink-0"
                            style={{ backgroundColor: nc.subjectColor || '#94A3B8' }}
                          />
                          <p className="text-lg font-semibold leading-tight truncate">{nc.subjectName || nc.className}</p>
                        </div>
                        <p className="text-sm text-gray-500 shrink-0 mt-0.5">
                          ครั้งที่ <span className="font-bold text-gray-900">{nc.sessionNumber}</span>
                          {nc.totalSessions ? <span className="font-normal">/{nc.totalSessions}</span> : null}
                        </p>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 ml-6">
                        {getDayName(new Date(nc.sessionDate).getDay())} {formatDate(nc.sessionDate, 'long')}
                      </p>
                      <div className="flex items-end justify-between gap-2 ml-6">
                        <p className="text-sm text-gray-500">
                          {nc.startTime?.slice(0, 5)}-{nc.endTime?.slice(0, 5)} น.
                          {nc.branchName && <> · {nc.branchName}</>}
                        </p>
                        <StudentBadge name={nc.studentName} size="md" className="shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Latest feedback */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-semibold text-gray-500">Feedback ล่าสุดจากครู</h2>
            <button className="text-xs text-primary font-medium" onClick={() => router.push('/liff/feedback')}>ดูทั้งหมด</button>
          </div>
          {data?.latestFeedback ? (
            <Card className="cursor-pointer active:scale-[0.98] transition-transform" onClick={() => router.push('/liff/feedback')}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: data.latestFeedback.subjectColor || '#94A3B8' }}
                    />
                    {/* Subject name only — class `name` is an internal code parents shouldn't see */}
                    <p className="text-lg font-semibold leading-tight truncate">
                      {data.latestFeedback.subjectName || data.latestFeedback.className}
                      <span className="text-sm font-normal text-gray-500"> · ครั้งที่ {data.latestFeedback.sessionNumber}</span>
                    </p>
                  </div>
                  <StudentBadge name={data.latestFeedback.studentName} size="md" className="shrink-0" />
                </div>
                <div className="ml-6">
                  {data.latestFeedback.feedback && (
                    <p className="text-base font-normal mt-1 line-clamp-2">{data.latestFeedback.feedback}</p>
                  )}
                  {data.latestFeedback.photoCount > 0 && (
                    <p className="flex items-center gap-1 text-xs text-purple-600 mt-1">
                      <ImageIcon className="h-3.5 w-3.5" /> {data.latestFeedback.photoCount} รูป
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-5 text-center text-sm text-gray-400">ยังไม่มี feedback</CardContent></Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LiffHomePage() {
  return <Dashboard />
}
