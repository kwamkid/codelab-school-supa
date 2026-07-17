'use client'

// Teams list: search (team/kid) + level filter with per-level counts, each team
// card shows kids + the two public-link copy buttons.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { Copy, Users, UserPlus, Pencil, Trash2, X, MessageCircle } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { LEVELS, type Level } from '@/lib/vex/types'
import { LevelBadge } from '@/components/vex/level-badge'
import { SearchInput } from '@/components/ui/search-input'
import { useBranch } from '@/contexts/BranchContext'
import { CreateTeamForm } from './create-team-form'
import { EditTeamForm } from './edit-team-form'
import { AddStudentsDialog } from './add-students-dialog'

interface KidRow {
  id: string
  nickname: string
  student_id?: string | null
  hasLine?: boolean
}
interface TeamRow {
  id: string
  team_number: string
  name: string | null
  level: Level
  branch_id: string | null
  branchName?: string | null
  eventLink: string | null
  practiceLink: string | null
  kids: KidRow[]
}

function publicUrl(kind: 'e' | 'p', slug: string) {
  // With the "Team" LIFF app configured (endpoint = /team), hand out
  // liff.line.me links: inside LINE they authenticate silently — no login
  // screen, no bounce to the parent portal.
  const vexLiffId = process.env.NEXT_PUBLIC_VEX_LIFF_ID
  if (vexLiffId) return `https://liff.line.me/${vexLiffId}/${kind}/${slug}`
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
    // Icon-only on mobile (the two text buttons were shoving the team number
    // off the card at 390px); the tooltip carries the label there.
    <Tooltip label={label}>
      <Button variant="outline" size="sm" onClick={copy} className="gap-1">
        <Copy className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{label}</span>
      </Button>
    </Tooltip>
  )
}

export function TeamsTab() {
  const { selectedBranchId } = useBranch()
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<Level | 'all'>('all')

  // Per-card actions
  const [editTeam, setEditTeam] = useState<TeamRow | null>(null)
  const [deleteTeam, setDeleteTeam] = useState<TeamRow | null>(null)
  const [addToTeam, setAddToTeam] = useState<TeamRow | null>(null)
  const [removeKid, setRemoveKid] = useState<{ team: TeamRow; kid: KidRow } | null>(null)
  const [busy, setBusy] = useState(false)

  const loadTeams = useCallback(async () => {
    const res = await authFetch('/api/admin/vex/teams')
    const data = await res.json()
    if (res.ok) setTeams(data.teams || [])
    else toast.error(data.error || 'โหลดทีมไม่สำเร็จ')
    setLoading(false)
  }, [])

  const doDeleteTeam = async () => {
    if (!deleteTeam) return
    setBusy(true)
    try {
      const res = await authFetch(`/api/admin/vex/teams/${deleteTeam.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) return toast.error(data.error || 'ลบทีมไม่สำเร็จ')
      toast.success('ลบทีมแล้ว')
      setDeleteTeam(null)
      loadTeams()
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setBusy(false)
    }
  }

  const doRemoveKid = async () => {
    if (!removeKid) return
    setBusy(true)
    try {
      const res = await authFetch(
        `/api/admin/vex/teams/${removeKid.team.id}/kids?kidId=${removeKid.kid.id}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) return toast.error(data.error || 'ลบนักเรียนไม่สำเร็จ')
      toast.success('ลบออกจากทีมแล้ว')
      setRemoveKid(null)
      loadTeams()
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  // Scope to the top-bar branch first (empty selectedBranchId = all branches).
  const branchTeams = useMemo(
    () => (selectedBranchId ? teams.filter((t) => t.branch_id === selectedBranchId) : teams),
    [teams, selectedBranchId]
  )

  const countByLevel = useMemo(() => {
    const m = new Map<Level, number>()
    for (const t of branchTeams) m.set(t.level, (m.get(t.level) || 0) + 1)
    return m
  }, [branchTeams])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return branchTeams.filter((t) => {
      if (levelFilter !== 'all' && t.level !== levelFilter) return false
      if (!q) return true
      const inTeam = t.team_number.toLowerCase().includes(q) || (t.name || '').toLowerCase().includes(q)
      const inKid = t.kids.some((k) => k.nickname.toLowerCase().includes(q))
      return inTeam || inKid
    })
  }, [branchTeams, search, levelFilter])

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

      {branchTeams.length === 0 ? (
        <EmptyState icon={Users} title="ยังไม่มีทีมในสาขานี้" description="สร้างทีม VEX เพื่อเริ่มต้น" />
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
              ทั้งหมด ({branchTeams.length})
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
                // py-0: shared Card's py-6 + CardContent p-4 double the
                // vertical padding otherwise.
                <Card key={t.id} className="py-0">
                  <CardContent className="p-4 space-y-3">
                    {/* Header row: name + branch + level + actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-lg">{t.team_number}</span>
                          {t.name && <span className="text-gray-500">— {t.name}</span>}
                          {!selectedBranchId && t.branchName && (
                            <Badge variant="outline" className="text-[10px] text-gray-500">{t.branchName}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {t.eventLink && (
                          <CopyLinkButton label="ตารางการแข่งขัน" url={publicUrl('e', t.eventLink)} />
                        )}
                        {t.practiceLink && (
                          <CopyLinkButton label="ตารางเข้าซ้อม" url={publicUrl('p', t.practiceLink)} />
                        )}
                        <LevelBadge level={t.level} logoHeight={24} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-primary"
                          onClick={() => setEditTeam(t)}
                          aria-label="แก้ไขทีม"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-red-600"
                          onClick={() => setDeleteTeam(t)}
                          aria-label="ลบทีม"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Students (removable) + add button. Each chip shows LINE
                        status so admins can tell the parent to connect LINE. */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {t.kids.map((k) => (
                        <Tooltip
                          key={k.id}
                          label={k.hasLine ? 'ผู้ปกครองเชื่อม LINE แล้ว (รับแจ้งเตือนได้)' : 'ยังไม่เชื่อม LINE — แจ้งผู้ปกครองให้เชื่อมเพื่อรับการแจ้งเตือน'}
                        >
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold',
                              k.hasLine ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                            )}
                          >
                            <MessageCircle
                              className={cn('h-4 w-4', k.hasLine ? 'text-green-500' : 'text-amber-400')}
                            />
                            <span className="vex-kid-name">{k.nickname}</span>
                            <button
                              type="button"
                              onClick={() => setRemoveKid({ team: t, kid: k })}
                              className="opacity-60 hover:text-red-600 hover:opacity-100"
                              aria-label={`ลบ ${k.nickname}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </Tooltip>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-primary border-primary/40 hover:bg-primary/5"
                        onClick={() => setAddToTeam(t)}
                      >
                        <UserPlus className="h-3.5 w-3.5" /> เพิ่มสมาชิก
                      </Button>
                    </div>
                    {t.kids.some((k) => !k.hasLine) && (
                      <p className="text-[11px] text-amber-600">
                        <MessageCircle className="h-3 w-3 inline mr-0.5" />
                        มีนักเรียนที่ผู้ปกครองยังไม่เชื่อม LINE — แจ้งให้เชื่อมเพื่อรับการแจ้งเตือน
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Edit team */}
      {editTeam && (
        <EditTeamForm
          team={editTeam}
          open={!!editTeam}
          onOpenChange={(o) => !o && setEditTeam(null)}
          onSaved={loadTeams}
        />
      )}

      {/* Add students */}
      {addToTeam && (
        <AddStudentsDialog
          teamId={addToTeam.id}
          open={!!addToTeam}
          onOpenChange={(o) => !o && setAddToTeam(null)}
          onAdded={loadTeams}
        />
      )}

      {/* Delete team confirm */}
      <AlertDialog open={!!deleteTeam} onOpenChange={(o) => !o && setDeleteTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบทีม {deleteTeam?.team_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              จะลบเด็ก, การแจ้งเข้าร่วม และการซ้อมของทีมนี้ทั้งหมด ไม่สามารถกู้คืนได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                doDeleteTeam()
              }}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700"
            >
              {busy ? 'กำลังลบ...' : 'ลบทีม'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove kid confirm */}
      <AlertDialog open={!!removeKid} onOpenChange={(o) => !o && setRemoveKid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ {removeKid?.kid.nickname} ออกจากทีม?</AlertDialogTitle>
            <AlertDialogDescription>
              การแจ้งเข้าร่วมและการซ้อมของนักเรียนคนนี้ในทีมนี้จะถูกลบด้วย
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                doRemoveKid()
              }}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700"
            >
              {busy ? 'กำลังลบ...' : 'ลบออกจากทีม'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
