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

interface NextClass {
  className: string; subjectName: string; sessionNumber: number
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
    studentName: string; className: string; subjectName?: string; sessionNumber: number
    sessionDate: string; feedback: string; photoCount: number
  }
}

function Dashboard() {
  const router = useRouter()
  const { profile, isLoading: liffLoading } = useLiff()
  const cacheKey = profile?.userId ? `home:${profile.userId}` : null
  const cached = cacheKey ? getLiffCache<HomeSummary>(cacheKey) : undefined
  const [loading, setLoading] = useState(!cached)
  const [data, setData] = useState<HomeSummary | null>(cached ?? null)
  const [goingProfile, setGoingProfile] = useState(false)

  useEffect(() => {
    if (liffLoading || !profile?.userId) return
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
  }, [liffLoading, profile?.userId])

  if (liffLoading || loading) return <Loading fullScreen size="lg" />

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
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-500 text-white shrink-0">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-lg font-semibold leading-tight">{nc.subjectName || nc.className}</p>
                            <p className="text-sm text-gray-500 shrink-0 mt-0.5">
                              ครั้งที่ <span className="font-bold text-gray-900">{nc.sessionNumber}</span>
                              {nc.totalSessions ? <span className="font-normal">/{nc.totalSessions}</span> : null}
                            </p>
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {getDayName(new Date(nc.sessionDate).getDay())} {formatDate(nc.sessionDate, 'long')}
                          </p>
                          <div className="flex items-end justify-between gap-2">
                            <p className="text-sm text-gray-500">
                              {nc.startTime?.slice(0, 5)}-{nc.endTime?.slice(0, 5)} น.
                              {nc.branchName && <> · {nc.branchName}</>}
                            </p>
                            <StudentBadge name={nc.studentName} size="md" className="shrink-0" />
                          </div>
                        </div>
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
                <div className="flex items-start gap-3">
                  {/* Same box/icon size as the next-class card so the column of
                      cards reads as one system. */}
                  <div className="p-2.5 rounded-xl bg-purple-500 text-white shrink-0">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      {/* Subject name only — class `name` is an internal code parents shouldn't see */}
                      <p className="text-lg font-semibold leading-tight">
                        {data.latestFeedback.subjectName || data.latestFeedback.className}
                        <span className="text-sm font-normal text-gray-500"> · ครั้งที่ {data.latestFeedback.sessionNumber}</span>
                      </p>
                      <StudentBadge name={data.latestFeedback.studentName} size="md" className="shrink-0" />
                    </div>
                    {data.latestFeedback.feedback && (
                      <p className="text-base font-normal mt-1 line-clamp-2">{data.latestFeedback.feedback}</p>
                    )}
                    {data.latestFeedback.photoCount > 0 && (
                      <p className="flex items-center gap-1 text-xs text-purple-600 mt-1">
                        <ImageIcon className="h-3.5 w-3.5" /> {data.latestFeedback.photoCount} รูป
                      </p>
                    )}
                  </div>
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
