'use client'

// Teams list: search (team/kid) + level filter with per-level counts, each team
// card shows kids + the two public-link copy buttons.

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { Copy, Users, ChevronRight } from 'lucide-react'
import { LEVELS, type Level } from '@/lib/vex/types'
import { LevelBadge } from '@/components/vex/level-badge'
import { StudentBadge } from '@/components/ui/student-badge'
import { SearchInput } from '@/components/ui/search-input'
import { CreateTeamForm } from './create-team-form'

interface TeamRow {
  id: string
  team_number: string
  name: string | null
  level: Level
  eventLink: string | null
  practiceLink: string | null
  kids: { id: string; nickname: string }[]
}

function publicUrl(kind: 'e' | 'p', slug: string) {
  if (typeof window === 'undefined') return `/team/${kind}/${slug}`
  return `${window.location.origin}/team/${kind}/${slug}`
}

function CopyLinkButton({ label, url }: { label: string; url: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(`คัดลอกลิงก์${label}แล้ว`)
    } catch {
      toast.error('คัดลอกไม่สำเร็จ')
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-1">
      <Copy className="h-3.5 w-3.5" /> {label}
    </Button>
  )
}

export function TeamsTab() {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<Level | 'all'>('all')

  const loadTeams = useCallback(async () => {
    const res = await authFetch('/api/admin/vex/teams')
    const data = await res.json()
    if (res.ok) setTeams(data.teams || [])
    else toast.error(data.error || 'โหลดทีมไม่สำเร็จ')
    setLoading(false)
  }, [])

  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  const countByLevel = useMemo(() => {
    const m = new Map<Level, number>()
    for (const t of teams) m.set(t.level, (m.get(t.level) || 0) + 1)
    return m
  }, [teams])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return teams.filter((t) => {
      if (levelFilter !== 'all' && t.level !== levelFilter) return false
      if (!q) return true
      const inTeam = t.team_number.toLowerCase().includes(q) || (t.name || '').toLowerCase().includes(q)
      const inKid = t.kids.some((k) => k.nickname.toLowerCase().includes(q))
      return inTeam || inKid
    })
  }, [teams, search, levelFilter])

  if (loading) return <PageLoading />

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="ค้นหาชื่อทีม หรือชื่อเด็ก"
          className="w-full sm:max-w-sm"
        />
        <CreateTeamForm onCreated={loadTeams} />
      </div>

      {teams.length === 0 ? (
        <EmptyState icon={Users} title="ยังไม่มีทีม" description="สร้างทีม VEX ทีมแรกเพื่อเริ่มต้น" />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLevelFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-md border text-sm font-medium transition',
                levelFilter === 'all'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-input text-gray-600 hover:bg-gray-50'
              )}
            >
              ทั้งหมด ({teams.length})
            </button>
            {LEVELS.filter((lv) => (countByLevel.get(lv) || 0) > 0).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setLevelFilter(lv)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition',
                  levelFilter === lv ? 'border-primary bg-primary/5' : 'border-input bg-white hover:bg-gray-50'
                )}
              >
                <LevelBadge level={lv} logoHeight={18} className="border-0 bg-transparent px-0 py-0" />
                <span className="text-gray-600">({countByLevel.get(lv) || 0})</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Users} title="ไม่พบทีม" description="ลองเปลี่ยนคำค้นหาหรือระดับ" />
          ) : (
            <div className="grid gap-3">
              {filtered.map((t) => (
                <Card key={t.id}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Link href={`/vexteam/${t.id}`} className="flex-1 min-w-0 group">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">{t.team_number}</span>
                        {t.name && <span className="text-gray-500">— {t.name}</span>}
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:translate-x-0.5 transition" />
                      </div>
                      {t.kids.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          {t.kids.map((k) => (
                            <StudentBadge key={k.id} name={k.nickname} />
                          ))}
                        </div>
                      )}
                    </Link>
                    <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                      {t.eventLink && (
                        <CopyLinkButton label="ตารางการแข่งขัน" url={publicUrl('e', t.eventLink)} />
                      )}
                      {t.practiceLink && (
                        <CopyLinkButton label="ตารางเข้าซ้อม" url={publicUrl('p', t.practiceLink)} />
                      )}
                      <LevelBadge level={t.level} logoHeight={26} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
