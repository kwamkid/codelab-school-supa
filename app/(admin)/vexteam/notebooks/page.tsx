'use client'

// VEX Team → EN Submit
// หน้ารวมลิงก์ Engineering Notebook ของทุกทีมไว้ที่เดียว สำหรับตอนนั่งกรอกฟอร์ม
// ส่งจริง: กดคัดลอกลิงก์ PDF ทีละทีมแล้ววางในฟอร์มได้เลย ไม่ต้องไล่เปิดทีละทีม
//
// แอดมินแก้ลิงก์ได้ทันทีในตาราง (รวบรวมลิงก์จากหลายทีมรวดเดียว) — ครูดูอย่างเดียว

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { StatusFilterTabs, type StatusFilterTab } from '@/components/ui/status-filter-tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortableTableHead, useSortableTable } from '@/components/ui/sortable-table-head'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { Tooltip } from '@/components/ui/tooltip'
import { TeacherBadge } from '@/components/ui/teacher-badge'
import { LevelBadge } from '@/components/vex/level-badge'
import { useBranch } from '@/contexts/BranchContext'
import { useAuth } from '@/hooks/useAuth'
import { LEVELS, type Level } from '@/lib/vex/types'
import { cn } from '@/lib/utils'
import { BookOpen, Copy, ExternalLink, FileCheck2, Check, Loader2, ArrowLeft } from 'lucide-react'

interface TeamRow {
  id: string
  team_number: string
  name: string | null
  level: Level
  branch_id: string | null
  branchName?: string | null
  coachName?: string | null
  coachImage?: string | null
  notebook_url?: string | null
  notebook_submit_url?: string | null
  kids?: { id: string; nickname: string }[]
}

function CopyButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Tooltip label={`คัดลอก${label}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            toast.success(`คัดลอก${label}แล้ว`)
            setTimeout(() => setCopied(false), 1500)
          } catch {
            toast.error('คัดลอกไม่สำเร็จ')
          }
        }}
        className="gap-1 shrink-0"
      >
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      </Button>
    </Tooltip>
  )
}

/** ช่องลิงก์ 1 ช่อง — แอดมินแก้ได้ในตาราง, ครูเห็นเป็นลิงก์อย่างเดียว */
function LinkCell({
  url,
  placeholder,
  emptyText,
  color,
  canManage,
  saving,
  onSave,
}: {
  url: string | null | undefined
  placeholder: string
  emptyText: string
  color: string
  canManage: boolean
  saving: boolean
  onSave: (value: string) => void
}) {
  const [draft, setDraft] = useState(url || '')
  useEffect(() => setDraft(url || ''), [url])
  const dirty = draft.trim() !== (url || '')

  if (!canManage) {
    return url ? (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cn('inline-flex items-center gap-1 hover:underline break-all', color)}
      >
        เปิดดู <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    ) : (
      <span className="text-base text-gray-400">{emptyText}</span>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && dirty) onSave(draft.trim())
        }}
        className="h-10 min-w-0 text-base"
      />
      {dirty ? (
        <Button size="sm" onClick={() => onSave(draft.trim())} disabled={saving} className="shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'บันทึก'}
        </Button>
      ) : (
        url && (
          <>
            <CopyButton url={url} label="ลิงก์" />
            <Tooltip label="เปิดในแท็บใหม่">
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </Tooltip>
          </>
        )
      )}
    </div>
  )
}

export default function VexNotebooksPage() {
  const router = useRouter()
  const { selectedBranchId } = useBranch()
  const { adminUser } = useAuth()
  const canManage = adminUser?.role === 'super_admin' || adminUser?.role === 'branch_admin'

  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'pending'>('all')
  const [levelFilter, setLevelFilter] = useState<Level | 'all'>('all')
  const [savingId, setSavingId] = useState<string | null>(null)
  // เรียงได้ตามเลขทีม/ชื่อทีม (ค่าเริ่มต้น = เรียงตามระดับ→เลขทีม)
  const { sort, toggle: toggleSort, sortRows } = useSortableTable()

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/vex/teams')
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'โหลดทีมไม่สำเร็จ')
        return
      }
      setTeams(data.teams || [])
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveLink = async (team: TeamRow, field: 'notebook_url' | 'notebook_submit_url', value: string) => {
    setSavingId(team.id)
    try {
      const res = await authFetch(`/api/admin/vex/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'บันทึกไม่สำเร็จ (ตรวจว่าเป็นลิงก์ที่ถูกต้อง)')
        return
      }
      toast.success('บันทึกลิงก์แล้ว')
      setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, [field]: value || null } : t)))
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setSavingId(null)
    }
  }

  // สาขาจากแถบบน → ระดับ → ค้นหา (นับสถานะจากขอบเขตนี้ ไม่รวมตัวกรองสถานะ)
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return teams
      .filter((t) => !selectedBranchId || t.branch_id === selectedBranchId)
      .filter((t) => levelFilter === 'all' || t.level === levelFilter)
      .filter((t) => !q || t.team_number.toLowerCase().includes(q) || (t.name || '').toLowerCase().includes(q))
      .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.team_number.localeCompare(b.team_number))
  }, [teams, selectedBranchId, levelFilter, search])

  const counts = useMemo(
    () => ({
      submitted: scoped.filter((t) => !!t.notebook_submit_url).length,
      pending: scoped.filter((t) => !t.notebook_submit_url).length,
      all: scoped.length,
    }),
    [scoped]
  )

  const rows = useMemo(() => {
    const byStatus =
      statusFilter === 'submitted'
        ? scoped.filter((t) => !!t.notebook_submit_url)
        : statusFilter === 'pending'
          ? scoped.filter((t) => !t.notebook_submit_url)
          : scoped
    return sortRows(byStatus, (t, key) => {
      if (key === 'team') return t.team_number
      if (key === 'name') return t.name || ''
      if (key === 'members') return t.kids?.length ?? 0
      return ''
    })
  }, [scoped, statusFilter, sortRows])

  const tabs: StatusFilterTab[] = [
    { value: 'pending', label: 'ยังไม่ส่ง PDF', count: counts.pending, activeBg: 'bg-amber-500', inactiveBg: 'bg-amber-50', inactiveLabel: 'text-amber-700', inactiveCount: 'text-amber-700', always: true },
    { value: 'submitted', label: 'ส่ง PDF แล้ว', count: counts.submitted, activeBg: 'bg-green-600', inactiveBg: 'bg-green-50', inactiveLabel: 'text-green-700', inactiveCount: 'text-green-700', always: true },
    { value: 'all', label: 'ทุกทีม', count: counts.all, activeBg: 'bg-gray-700', inactiveBg: 'bg-gray-100', inactiveLabel: 'text-gray-600', inactiveCount: 'text-gray-700', always: true, separatorBefore: true },
  ]

  if (loading) return <PageLoading />

  return (
    <div className="p-4 sm:p-6 text-base">
      <Button variant="ghost" onClick={() => router.push('/vexteam')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        กลับ
      </Button>

      <PageHeader
        title="EN Submit"
        icon={FileCheck2}
        iconColor="text-red-600"
        description="รวมลิงก์ Engineering Notebook ของทุกทีม — คัดลอกลิงก์ PDF ไปวางในฟอร์มส่งได้เลย"
      />

      <div className="space-y-4">
        <StatusFilterTabs tabs={tabs} value={statusFilter} onChange={(v) => setStatusFilter(v as any)} />

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="ค้นหาหมายเลข/ชื่อทีม"
            className="w-full sm:max-w-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLevelFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-md border text-sm font-medium transition',
                levelFilter === 'all' ? 'border-primary bg-primary/5 text-primary' : 'border-input text-gray-600 hover:bg-gray-50'
              )}
            >
              ทุกระดับ
            </button>
            {LEVELS.filter((lv) => teams.some((t) => t.level === lv)).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setLevelFilter(lv)}
                className={cn(
                  'px-2 py-1 rounded-md border transition',
                  levelFilter === lv ? 'border-primary bg-primary/5' : 'border-input hover:bg-gray-50'
                )}
              >
                <LevelBadge level={lv} className="border-0 bg-transparent px-0 py-0" />
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={BookOpen} title="ไม่พบทีม" description="ลองเปลี่ยนตัวกรองหรือคำค้นหา" />
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead sortKey="team" currentSort={sort} onSort={toggleSort} className="min-w-[130px] text-base">
                    เลขทีม
                  </SortableTableHead>
                  <SortableTableHead sortKey="name" currentSort={sort} onSort={toggleSort} className="min-w-[140px] text-base">
                    ชื่อทีม
                  </SortableTableHead>
                  <SortableTableHead sortKey="members" currentSort={sort} onSort={toggleSort} className="min-w-[180px] text-base">
                    สมาชิกทีม
                  </SortableTableHead>
                  <TableHead className="min-w-[150px] text-base">ครูผู้ดูแล</TableHead>
                  <TableHead className="min-w-[280px] text-base">
                    <span className="inline-flex items-center gap-1 text-blue-600">
                      <BookOpen className="h-4 w-4" /> ฉบับกำลังทำ
                    </span>
                  </TableHead>
                  <TableHead className="min-w-[280px] text-base">
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <FileCheck2 className="h-4 w-4" /> ฉบับส่ง (PDF)
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id} className={cn(!t.notebook_submit_url && 'bg-amber-50/40')}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <LevelBadge level={t.level} logoHeight={22} className="border-0 bg-transparent px-0 py-0" />
                        <div className="min-w-0">
                          <div className="text-xl font-bold leading-tight">{t.team_number}</div>
                          {!selectedBranchId && t.branchName && (
                            <div className="text-sm text-gray-400">{t.branchName}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {t.name ? (
                        <span className="text-lg font-semibold">{t.name}</span>
                      ) : (
                        <span className="text-base text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.kids?.length ? (
                        <span className="text-base">
                          <span className="text-gray-400">{t.kids.length} คน · </span>
                          {t.kids.map((k) => k.nickname).join(', ')}
                        </span>
                      ) : (
                        <span className="text-base text-gray-400">ยังไม่มีสมาชิก</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.coachName ? (
                        <TeacherBadge name={t.coachName} imageUrl={t.coachImage} size="md" />
                      ) : (
                        <span className="text-base text-amber-600">ยังไม่ระบุ</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <LinkCell
                        url={t.notebook_url}
                        placeholder="ลิงก์ Canva / Slides"
                        emptyText="ยังไม่มี"
                        color="text-blue-600"
                        canManage={canManage}
                        saving={savingId === t.id}
                        onSave={(v) => saveLink(t, 'notebook_url', v)}
                      />
                    </TableCell>
                    <TableCell>
                      <LinkCell
                        url={t.notebook_submit_url}
                        placeholder="ลิงก์ PDF บน Google Drive"
                        emptyText="ยังไม่ส่ง"
                        color="text-green-700"
                        canManage={canManage}
                        saving={savingId === t.id}
                        onSave={(v) => saveLink(t, 'notebook_submit_url', v)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
