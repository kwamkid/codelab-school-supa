'use client'

// ติดตามลูกค้า — งานโทรเชียร์ขาย/รักษาลูกค้า 3 แบบในหน้าเดียว (super_admin + branch_admin)
//   1) ทดลองเรียนแล้วหายไป  — มาทดลองแล้วครอบครัวยังไม่สมัคร
//   2) เด็กเสี่ยงเลิกเรียน   — ไม่ได้มาเรียนติดกันหลายคาบ
//   3) จะจบคอร์ส           — คลาสจบเร็ว ๆ นี้ และยังไม่ได้ลงคอร์สต่อ
// ทุกรายการมีสถานะ ยังไม่ติดต่อ / ติดต่อแล้ว (+ผลการคุย) / ติดต่อไม่ได้ — ด้านบนสรุป "ยังไม่ติดต่อกี่คน"
// (แยกสาขาเมื่อดูทุกสาขา) ให้ CEO ตามงานได้ · แอดมินสาขาเห็นเฉพาะสาขาตัวเอง (API clamp)
// สถานะผูกกับ "รอบ" (episode) — งานรอบใหม่ (ขาดรอบใหม่/ทดลองครั้งใหม่) กลับเป็น "ยังไม่ติดต่อ"
// ข้อมูล: GET /api/admin/followups · บันทึก: POST /api/admin/followups

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarX2, PhoneCall, RefreshCw, TestTube, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/auth-fetch'
import { useAdminJson } from '@/hooks/useAdminJson'
import { useBranch } from '@/contexts/BranchContext'
import { RoleGate } from '@/components/auth/role-gate'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { FormSelect } from '@/components/ui/form-select'
import { SearchInput } from '@/components/ui/search-input'
import { StatusFilterTabs } from '@/components/ui/status-filter-tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { PageLoading } from '@/components/ui/loading'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Pill, type PillTone } from '@/components/ui/pill'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { thaiDateLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

// ---------- types ----------

type Kind = 'trial' | 'at_risk' | 'ending'
type FollowStatus = 'contacted' | 'no_answer'
type RowStatus = 'pending' | FollowStatus | 'renewed'

interface Followup { status: FollowStatus; reason: string | null; note: string | null; by: string | null; at: string; episode?: string }

interface Base {
  branchId: string
  branchName: string
  parentName: string | null
  parentPhone: string | null
  subject: string
  teacher: string | null
  episode: string
  followup: Followup | null
  history: Followup[]
}
interface TrialRow extends Base {
  sessionId: string; bookingId: string; studentName: string; trialDate: string; daysAgo: number
  trialCount: number; feedback: string | null; contactNote: string | null; existingCustomer: boolean
}
interface AtRiskRow extends Base {
  enrollmentId: string; studentName: string; studentNickname: string | null; classId: string; classCode: string
  streak: number; absent: number; excused: number; lastPresent: string | null
}
interface EndingRow extends Base {
  enrollmentId: string; studentName: string; studentNickname: string | null; classId: string; classCode: string
  endDate: string; daysLeft: number; sessionsLeft: number; renewedTo: { subject: string; startDate: string } | null
}
interface Data { trial: TrialRow[]; atRisk: AtRiskRow[]; ending: EndingRow[] }

type AnyRow = TrialRow | AtRiskRow | EndingRow

// ---------- config ----------

const KIND_META: Record<Kind, { label: string; icon: typeof TestTube; hint: string }> = {
  trial: { label: 'ทดลองเรียนแล้วหายไป', icon: TestTube, hint: 'มาทดลองเรียนแล้ว แต่ครอบครัวยังไม่สมัครคอร์สใดเลย (ดูจากเบอร์โทร) — โทรชวนสมัคร' },
  at_risk: { label: 'เด็กเสี่ยงเลิกเรียน', icon: UserX, hint: 'ไม่ได้มาเรียน (ขาด/ลา/ป่วย) ติดกันหลายคาบล่าสุดที่เช็คชื่อ — โทรถามสาเหตุก่อนเด็กหลุด' },
  ending: { label: 'จะจบคอร์ส', icon: CalendarX2, hint: 'คลาสจะจบเร็ว ๆ นี้ — โทรชวนลงคอร์สถัดไป (ลงต่อแล้วจะขึ้นป้ายเขียว ไม่ต้องโทร)' },
}

const REASONS: Record<Kind, string[]> = {
  trial: ['สนใจ รอเปิดรุ่น/รอจังหวะ', 'ขอคิดก่อน', 'ราคาสูงไป', 'เวลาเรียนไม่สะดวก', 'ไกล / การเดินทาง', 'เด็กไม่ชอบ', 'เลือกที่อื่นแล้ว', 'สมัครแล้ว', 'อื่น ๆ'],
  at_risk: ['ป่วย / บาดเจ็บ', 'ติดธุระ / เดินทาง', 'เวลาเรียนไม่สะดวก', 'เด็กไม่อยากเรียน / เรียนไม่ทัน', 'ค่าใช้จ่าย', 'ย้ายบ้าน / ย้ายโรงเรียน', 'จะกลับมาเรียน', 'จะเลิกเรียน', 'อื่น ๆ'],
  ending: ['จะลงคอร์สต่อ', 'รอเปิดรุ่นถัดไป', 'ขอคิดก่อน', 'ราคา', 'เวลาเรียนไม่สะดวก', 'เด็กอยากพัก', 'จะเลิกเรียน', 'อื่น ๆ'],
}

const STATUS_META: Record<RowStatus, { label: string; tone: PillTone }> = {
  pending: { label: 'ยังไม่ติดต่อ', tone: 'red' },
  no_answer: { label: 'ติดต่อไม่ได้', tone: 'amber' },
  contacted: { label: 'ติดต่อแล้ว', tone: 'green' },
  renewed: { label: 'ลงต่อแล้ว', tone: 'emerald' },
}

const WINDOW_OPTIONS: Record<Kind, { value: string; label: string }[]> = {
  trial: [{ value: '30', label: 'ทดลองใน 30 วัน' }, { value: '60', label: 'ทดลองใน 60 วัน' }, { value: '120', label: 'ทดลองใน 120 วัน' }, { value: '365', label: 'ทดลองใน 1 ปี' }],
  at_risk: [{ value: '2', label: 'ขาดติดกัน 2 ครั้งขึ้นไป' }, { value: '3', label: 'ขาดติดกัน 3 ครั้งขึ้นไป' }, { value: '4', label: 'ขาดติดกัน 4 ครั้งขึ้นไป' }],
  ending: [{ value: '14', label: 'จบใน 14 วัน' }, { value: '30', label: 'จบใน 30 วัน' }, { value: '60', label: 'จบใน 60 วัน' }],
}

const refIdOf = (kind: Kind, r: AnyRow) => (kind === 'trial' ? (r as TrialRow).sessionId : (r as AtRiskRow | EndingRow).enrollmentId)
const nameOf = (r: AnyRow) => ('studentNickname' in r && r.studentNickname) || r.studentName

function statusOf(kind: Kind, r: AnyRow): RowStatus {
  if (kind === 'ending' && (r as EndingRow).renewedTo) return 'renewed'
  return r.followup?.status ?? 'pending'
}

function dateTimeLabel(iso: string) {
  const d = new Date(iso)
  const ymd = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const hm = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
  return `${thaiDateLabel(ymd)} ${hm}`
}

function tally(kind: Kind, rows: AnyRow[]) {
  const t = { total: rows.length, pending: 0, no_answer: 0, contacted: 0, renewed: 0 }
  for (const r of rows) t[statusOf(kind, r)]++
  return t
}

// ---------- page ----------

export default function FollowupsPage() {
  return (
    <RoleGate roles={['super_admin', 'branch_admin']}>
      <Followups />
    </RoleGate>
  )
}

function Followups() {
  const { selectedBranchId, isAllBranches } = useBranch()
  const [kind, setKind] = useState<Kind>('trial')
  const [status, setStatus] = useState<RowStatus | 'all'>('pending')
  const [search, setSearch] = useState('')
  const [windows, setWindows] = useState<Record<Kind, string>>({ trial: '120', at_risk: '2', ending: '30' })
  const [editing, setEditing] = useState<{ kind: Kind; row: AnyRow } | null>(null)

  // deep link: /followups#at_risk (plain hash — survives without useSearchParams/Suspense)
  useEffect(() => {
    const h = window.location.hash.slice(1)
    if (h === 'trial' || h === 'at_risk' || h === 'ending') setKind(h)
  }, [])

  const qs = new URLSearchParams({ trialDays: windows.trial, minStreak: windows.at_risk, endingDays: windows.ending })
  if (selectedBranchId) qs.set('branchId', selectedBranchId)
  const { data, loading, reload } = useAdminJson<Data>(`/api/admin/followups?${qs}`, 'โหลดรายชื่อไม่สำเร็จ')

  const lists: Record<Kind, AnyRow[]> = useMemo(() => ({
    trial: data?.trial ?? [], at_risk: data?.atRisk ?? [], ending: data?.ending ?? [],
  }), [data])

  const rows = lists[kind]
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => [r.studentName, 'studentNickname' in r ? r.studentNickname : null, r.parentName, r.parentPhone, r.subject]
      .some((v) => v?.toLowerCase().includes(q)))
  }, [rows, search])
  const t = tally(kind, searched)
  const list = status === 'all' ? searched : searched.filter((r) => statusOf(kind, r) === status)

  // CEO view: ยังไม่ติดต่อ แยกสาขา × ประเภท
  const byBranch = useMemo(() => {
    const map = new Map<string, { name: string } & Record<Kind, { total: number; pending: number }>>()
    for (const k of ['trial', 'at_risk', 'ending'] as Kind[]) {
      for (const r of lists[k]) {
        const x = map.get(r.branchId) ?? { name: r.branchName, trial: { total: 0, pending: 0 }, at_risk: { total: 0, pending: 0 }, ending: { total: 0, pending: 0 } }
        x[k].total++
        if (statusOf(k, r) === 'pending') x[k].pending++
        map.set(r.branchId, x)
      }
    }
    return Array.from(map.values())
  }, [lists])

  if (loading && !data) return <PageLoading />

  const switchKind = (k: Kind) => { setKind(k); setStatus('pending'); history.replaceState(null, '', `#${k}`) }

  return (
    <div className="p-4 sm:p-6 text-base relative min-w-0">
      <LoadingOverlay show={loading && !!data} />
      <PageHeader
        title="ติดตามลูกค้า"
        icon={PhoneCall}
        iconColor="text-rose-500"
        description="โทรชวนสมัคร · ถามเด็กที่หายไป · ชวนลงคอร์สต่อ — บันทึกผลทุกครั้งเพื่อให้ทีมเห็นตรงกัน"
        action={
          <Button variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> รีเฟรช
          </Button>
        }
      />

      <div className="space-y-5 min-w-0">
        {/* สรุป 3 งาน — กดเพื่อสลับ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['trial', 'at_risk', 'ending'] as Kind[]).map((k) => {
            const s = tally(k, lists[k])
            const Icon = KIND_META[k].icon
            const active = k === kind
            return (
              <button
                key={k}
                type="button"
                onClick={() => switchKind(k)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors min-w-0',
                  active ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30' : 'border-gray-200 bg-white hover:bg-gray-50',
                )}
              >
                <div className="flex items-center gap-2 font-medium">
                  <Icon className="h-5 w-5 text-rose-500 shrink-0" />
                  <span className="truncate">{KIND_META[k].label}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={cn('num text-3xl font-bold', s.pending ? 'text-red-600' : 'text-emerald-600')}>{s.pending}</span>
                  <span className="text-gray-600">ยังไม่ติดต่อ</span>
                </div>
                <div className="num text-gray-500 mt-1">
                  ทั้งหมด {s.total} · ติดต่อแล้ว {s.contacted} · ติดต่อไม่ได้ {s.no_answer}
                  {k === 'ending' && ` · ลงต่อแล้ว ${s.renewed}`}
                </div>
              </button>
            )
          })}
        </div>

        {isAllBranches && byBranch.length > 1 && (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>สาขา</TableHead>
                  {(['trial', 'at_risk', 'ending'] as Kind[]).map((k) => (
                    <TableHead key={k} className="text-right">{KIND_META[k].label} (ยังไม่ติดต่อ/ทั้งหมด)</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {byBranch.map((b) => (
                  <TableRow key={b.name}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    {(['trial', 'at_risk', 'ending'] as Kind[]).map((k) => (
                      <TableCell key={k} className="num text-right">
                        <span className={cn(b[k].pending && 'text-red-600 font-semibold')}>{b[k].pending}</span> / {b[k].total}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <h2 className="text-xl font-semibold text-gray-900 pt-1">{KIND_META[kind].label}</h2>
        <p className="text-gray-600 -mt-3">{KIND_META[kind].hint}</p>

        <StatusFilterTabs
          value={status}
          onChange={(v) => setStatus(v as typeof status)}
          tabs={[
            { value: 'pending', label: 'ยังไม่ติดต่อ', count: t.pending, always: true,
              activeBg: 'bg-red-500', inactiveBg: 'bg-red-50', inactiveLabel: 'text-red-600', inactiveCount: 'text-red-700' },
            { value: 'no_answer', label: 'ติดต่อไม่ได้', count: t.no_answer, always: true,
              activeBg: 'bg-amber-500', inactiveBg: 'bg-amber-50', inactiveLabel: 'text-amber-600', inactiveCount: 'text-amber-700' },
            { value: 'contacted', label: 'ติดต่อแล้ว', count: t.contacted, always: true,
              activeBg: 'bg-green-500', inactiveBg: 'bg-green-50', inactiveLabel: 'text-green-600', inactiveCount: 'text-green-700' },
            ...(kind === 'ending' ? [{ value: 'renewed', label: 'ลงต่อแล้ว', count: t.renewed, always: true,
              activeBg: 'bg-emerald-600', inactiveBg: 'bg-emerald-50', inactiveLabel: 'text-emerald-600', inactiveCount: 'text-emerald-700' }] : []),
            { value: 'all', label: 'ทั้งหมด', count: t.total, always: true, separatorBefore: true,
              activeBg: 'bg-indigo-500', inactiveBg: 'bg-indigo-50', inactiveLabel: 'text-indigo-600', inactiveCount: 'text-indigo-700' },
          ]}
        />

        <div className="flex flex-wrap items-center gap-3">
          <FormSelect
            value={windows[kind]}
            onValueChange={(v) => setWindows((w) => ({ ...w, [kind]: v }))}
            options={WINDOW_OPTIONS[kind]}
            className="w-[240px]"
          />
          <SearchInput value={search} onChange={setSearch} placeholder="ค้นหาชื่อเด็ก ผู้ปกครอง เบอร์ หรือคอร์ส" className="w-full sm:w-[360px]" />
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={KIND_META[kind].icon}
            title={status === 'pending' ? 'ไม่มีรายชื่อที่ต้องติดต่อ' : 'ไม่มีรายการ'}
            description={status === 'pending' ? 'ทุกคนในกลุ่มนี้ได้รับการติดต่อแล้ว' : undefined}
          />
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">นักเรียน / ผู้ปกครอง</TableHead>
                  <TableHead className="min-w-[200px]">{kind === 'trial' ? 'ทดลองเรียน' : 'คลาส'}</TableHead>
                  <TableHead className="min-w-[150px]">{kind === 'trial' ? 'เมื่อ' : kind === 'at_risk' ? 'ขาดติดกัน' : 'จบคลาส'}</TableHead>
                  <TableHead className="min-w-[220px]">สถานะ</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r) => {
                  const st = statusOf(kind, r)
                  return (
                    <TableRow key={refIdOf(kind, r)}>
                      <TableCell>
                        <div className="font-medium">{nameOf(r)}</div>
                        <div className="text-gray-500">
                          {r.parentName || '—'}
                          {r.parentPhone && <> · <a href={`tel:${r.parentPhone}`} className="num text-blue-600 hover:underline">{r.parentPhone}</a></>}
                        </div>
                        {kind === 'trial' && (r as TrialRow).existingCustomer && <Pill tone="indigo" className="mt-1">ลูกค้าเก่า</Pill>}
                      </TableCell>
                      <TableCell>
                        {kind === 'trial' ? (
                          <Link href={`/trial/${(r as TrialRow).bookingId}`} className="hover:underline">{r.subject}</Link>
                        ) : (
                          <Link href={`/classes/${(r as AtRiskRow).classId}`} className="hover:underline">{r.subject}</Link>
                        )}
                        <div className="text-gray-500">
                          {kind !== 'trial' && (r as AtRiskRow).classCode}
                          {r.teacher && `${kind !== 'trial' ? ' · ' : ''}ครู${r.teacher}`}
                        </div>
                        {isAllBranches && <div className="text-gray-500">{r.branchName}</div>}
                      </TableCell>
                      <TableCell className="num">
                        {kind === 'trial' && (() => {
                          const x = r as TrialRow
                          return (
                            <>
                              <div>{thaiDateLabel(x.trialDate)}</div>
                              <div className="text-gray-500">{x.daysAgo} วันก่อน{x.trialCount > 1 && ` · มา ${x.trialCount} ครั้ง`}</div>
                            </>
                          )
                        })()}
                        {kind === 'at_risk' && (() => {
                          const x = r as AtRiskRow
                          return (
                            <>
                              <Pill tone={x.streak >= 3 ? 'red' : 'amber'}>{x.streak} ครั้ง</Pill>
                              <div className="text-gray-500 mt-1">มาล่าสุด {x.lastPresent ? thaiDateLabel(x.lastPresent) : 'ยังไม่เคยมา'}</div>
                            </>
                          )
                        })()}
                        {kind === 'ending' && (() => {
                          const x = r as EndingRow
                          return (
                            <>
                              <div>{thaiDateLabel(x.endDate)}</div>
                              <div className="text-gray-500">อีก {x.daysLeft} วัน · เหลือ {x.sessionsLeft} คาบ</div>
                            </>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        <Pill tone={STATUS_META[st].tone}>{STATUS_META[st].label}</Pill>
                        {st === 'renewed' && (r as EndingRow).renewedTo && (
                          <div className="mt-1">{(r as EndingRow).renewedTo!.subject} · เริ่ม {thaiDateLabel((r as EndingRow).renewedTo!.startDate)}</div>
                        )}
                        {r.followup?.reason && <div className="mt-1">{r.followup.reason}</div>}
                        {r.followup?.note && <div className="text-gray-500 line-clamp-2">{r.followup.note}</div>}
                        {r.followup && <div className="text-gray-500">{r.followup.by ? `${r.followup.by} · ` : ''}{dateTimeLabel(r.followup.at)}</div>}
                      </TableCell>
                      <TableCell>
                        {st !== 'renewed' && (
                          <Button variant={st === 'pending' ? 'default' : 'outline'} onClick={() => setEditing({ kind, row: r })} className="whitespace-nowrap">
                            <PhoneCall className="h-4 w-4 mr-2" /> บันทึกการติดต่อ
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <FollowupDialog target={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
    </div>
  )
}

// ---------- dialog ----------

function FollowupDialog({ target, onClose, onSaved }: {
  target: { kind: Kind; row: AnyRow } | null
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState<FollowStatus>('contacted')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [forKey, setForKey] = useState<string | null>(null)

  const key = target ? `${target.kind}:${refIdOf(target.kind, target.row)}` : null
  if (target && key !== forKey) {
    setForKey(key)
    setStatus(target.row.followup?.status ?? 'contacted')
    setReason(target.row.followup?.reason ?? '')
    setNote('')
  }

  const save = async () => {
    if (!target || busy.current) return
    if (status === 'contacted' && !reason) { toast.error('กรุณาเลือกผลการคุย'); return }
    busy.current = true
    setSaving(true)
    try {
      const res = await authFetch('/api/admin/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: target.kind,
          refId: refIdOf(target.kind, target.row),
          episode: target.row.episode,
          status,
          reason: status === 'contacted' ? reason : null,
          note,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ')
      toast.success('บันทึกแล้ว')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  const row = target?.row
  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open) { setForKey(null); onClose() } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>บันทึกการติดต่อ — {row ? nameOf(row) : ''}</DialogTitle>
          <DialogDescription className="text-base">
            {target && KIND_META[target.kind].label} · {row?.subject}
            {row?.parentPhone && <> · <a href={`tel:${row.parentPhone}`} className="num text-blue-600 hover:underline">{row.parentPhone}</a></>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base">ผลการติดต่อ</Label>
            <RadioGroup value={status} onValueChange={(v) => setStatus(v as FollowStatus)} className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="contacted" /> ติดต่อได้ คุยแล้ว</label>
              <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="no_answer" /> ติดต่อไม่ได้</label>
            </RadioGroup>
          </div>

          {status === 'contacted' && target && (
            <div className="space-y-2">
              <Label className="text-base">ผลการคุย / สาเหตุ</Label>
              <FormSelect value={reason} onValueChange={setReason} options={REASONS[target.kind].map((r) => ({ value: r, label: r }))} placeholder="เลือก" />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-base">หมายเหตุ</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="รายละเอียดที่คุย เช่น จะโทรกลับวันเสาร์ / สนใจคอร์ส Python" rows={3} />
          </div>

          {!!row?.history.length && (
            <div className="space-y-1.5">
              <Label className="text-base">ประวัติการติดต่อ</Label>
              <div className="max-h-40 overflow-y-auto space-y-1.5">
                {row.history.map((h, i) => (
                  <div key={i} className="rounded-md bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Pill tone={STATUS_META[h.status].tone}>{STATUS_META[h.status].label}</Pill>
                      {h.reason && <span>{h.reason}</span>}
                    </div>
                    {h.note && <div className="text-gray-600 mt-1">{h.note}</div>}
                    <div className="text-gray-500">{h.by ? `${h.by} · ` : ''}{dateTimeLabel(h.at)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
