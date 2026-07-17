'use client'

// รายงาน VEX Team — who registers for VEX teams: which schools they come from,
// their ages, and which CodeLab courses they've taken. Scoped by the top-bar
// branch selector like the rest of /vexteam.

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { useBranch } from '@/contexts/BranchContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LevelBadge } from '@/components/vex/level-badge'
import { SectionLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { Trophy, Users, School, Cake } from 'lucide-react'
import { toast } from 'sonner'

interface ReportData {
  totalTeams: number
  totalKids: number
  byLevel: { level: string; teams: number; kids: number }[]
  schools: { school: string; count: number }[]
  ages: { age: number; count: number }[]
  courses: { name: string; color: string | null; students: number }[]
}

// Simple horizontal bar row: label left, count right, tinted bar underneath.
function BarRow({ label, count, max, color }: { label: React.ReactNode; count: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-base">
        <div className="min-w-0 truncate">{label}</div>
        <div className="font-semibold tabular-nums shrink-0">{count} คน</div>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color || '#6366F1' }}
        />
      </div>
    </div>
  )
}

export default function VexTeamReportPage() {
  const { selectedBranchId } = useBranch()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const qs = selectedBranchId ? `?branchId=${selectedBranchId}` : ''
      const res = await authFetch(`/api/admin/vex/report${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'โหลดรายงานไม่สำเร็จ')
      setData(json)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'โหลดรายงานไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [selectedBranchId])

  useEffect(() => { load() }, [load])

  if (loading && !data) return <SectionLoading />

  const totalStudents = data?.schools.reduce((s, r) => s + r.count, 0) || 0
  const avgAge = (() => {
    const rows = data?.ages || []
    const n = rows.reduce((s, r) => s + r.count, 0)
    if (!n) return null
    return (rows.reduce((s, r) => s + r.age * r.count, 0) / n).toFixed(1)
  })()
  const maxSchool = Math.max(0, ...(data?.schools.map((s) => s.count) || []))
  const maxAge = Math.max(0, ...(data?.ages.map((a) => a.count) || []))
  const maxCourse = Math.max(0, ...(data?.courses.map((c) => c.students) || []))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Trophy className="h-8 w-8 text-amber-500" />
          รายงาน VEX Team
        </h1>
        <p className="text-gray-600 mt-1">นักเรียนที่สมัครทีม VEX: โรงเรียน อายุ และคอร์สที่เคยเรียน</p>
      </div>

      {/* Stat cards (full-colour gradient per project convention) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-4 text-white bg-gradient-to-br from-amber-500 to-amber-600">
          <div className="flex items-center gap-2 text-white/90 text-sm"><Trophy className="h-4 w-4" /> ทีมทั้งหมด</div>
          <div className="text-3xl font-bold mt-1">{data?.totalTeams ?? 0}</div>
        </div>
        <div className="rounded-xl p-4 text-white bg-gradient-to-br from-blue-500 to-blue-600">
          <div className="flex items-center gap-2 text-white/90 text-sm"><Users className="h-4 w-4" /> นักเรียนในทีม</div>
          <div className="text-3xl font-bold mt-1">{data?.totalKids ?? 0}</div>
        </div>
        <div className="rounded-xl p-4 text-white bg-gradient-to-br from-emerald-500 to-emerald-600">
          <div className="flex items-center gap-2 text-white/90 text-sm"><School className="h-4 w-4" /> จำนวนโรงเรียน</div>
          <div className="text-3xl font-bold mt-1">{data?.schools.filter((s) => s.school !== 'ไม่ระบุ').length ?? 0}</div>
        </div>
        <div className="rounded-xl p-4 text-white bg-gradient-to-br from-purple-500 to-purple-600">
          <div className="flex items-center gap-2 text-white/90 text-sm"><Cake className="h-4 w-4" /> อายุเฉลี่ย</div>
          <div className="text-3xl font-bold mt-1">{avgAge ? `${avgAge} ปี` : '—'}</div>
        </div>
      </div>

      {/* Per-level breakdown */}
      {(data?.byLevel.length || 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {data!.byLevel.map((lv) => (
            <div key={lv.level} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5">
              <LevelBadge level={lv.level as any} logoHeight={18} className="border-0 bg-transparent px-0 py-0" />
              <span className="text-sm text-gray-600">{lv.teams} ทีม · {lv.kids} คน</span>
            </div>
          ))}
        </div>
      )}

      {data && data.totalKids === 0 ? (
        <EmptyState icon={Users} title="ยังไม่มีนักเรียนในทีม" description="เพิ่มสมาชิกทีมเพื่อดูรายงาน" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Schools */}
          <Card className="py-0">
            <CardContent className="p-5">
              <CardTitle className="text-lg mb-4 flex items-center gap-2">
                <School className="h-5 w-5 text-emerald-600" /> โรงเรียน
              </CardTitle>
              <div className="space-y-3">
                {data?.schools.map((s) => (
                  <BarRow key={s.school} label={s.school} count={s.count} max={maxSchool} color="#10B981" />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ages */}
          <Card className="py-0">
            <CardContent className="p-5">
              <CardTitle className="text-lg mb-4 flex items-center gap-2">
                <Cake className="h-5 w-5 text-purple-600" /> อายุ
              </CardTitle>
              <div className="space-y-3">
                {data?.ages.length === 0 && (
                  <p className="text-sm text-gray-400">ไม่มีข้อมูลวันเกิด</p>
                )}
                {data?.ages.map((a) => (
                  <BarRow key={a.age} label={`${a.age} ปี`} count={a.count} max={maxAge} color="#A855F7" />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Courses taken */}
          <Card className="py-0 lg:col-span-2">
            <CardContent className="p-5">
              <CardTitle className="text-lg mb-1 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" /> คอร์สที่เคยเรียน
              </CardTitle>
              <p className="text-sm text-gray-500 mb-4">
                นับจำนวนนักเรียนในทีมที่เคยลงเรียนแต่ละวิชา (1 คนเรียนได้หลายวิชา)
              </p>
              <div className="space-y-3">
                {data?.courses.length === 0 && (
                  <p className="text-sm text-gray-400">ยังไม่มีประวัติการเรียน</p>
                )}
                {data?.courses.map((c) => (
                  <BarRow
                    key={c.name}
                    label={
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color || '#94A3B8' }} />
                        {c.name}
                      </span>
                    }
                    count={c.students}
                    max={maxCourse}
                    color={c.color || '#3B82F6'}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
