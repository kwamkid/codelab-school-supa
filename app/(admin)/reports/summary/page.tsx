'use client'

// สรุปผลย้อนหลัง (super_admin · ลิงก์ตรงเท่านั้น ไม่มีในเมนู) — ยอดขายรายเดือนแยกสาขา +
// ครูเช็คชื่อ / Teacher Feedback รายเดือนและรายครู
// ข้อมูลจาก /api/admin/reports/summary (ใช้ RPC ตัวเดียวกับรายงานผู้บริหาร + รายงานครูรายเดือน ตัวเลขจึงตรงกัน)

import { useCallback, useMemo, useState } from 'react'
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from 'recharts'
import { Banknote, CalendarCheck, ClipboardList, MessageSquare, RefreshCw, TestTube, UserPlus, UserX } from 'lucide-react'
import { useAdminJson } from '@/hooks/useAdminJson'
import { RoleGate } from '@/components/auth/role-gate'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { FormSelect } from '@/components/ui/form-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageLoading } from '@/components/ui/loading'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { StickyBar } from '@/components/ui/sticky-bar'
import { KpiCard } from '@/components/ui/kpi-card'
import { ChartCard } from '@/components/ui/chart-card'
import { RateCell } from '@/components/ui/rate-cell'
import { Pill } from '@/components/ui/pill'
import { formatBaht, formatCompact, formatNumber, percentText, thaiDateLabel, thaiMonthLabel } from '@/lib/format'
import { CHART_COLORS, branchColor, chartAxisTick, chartGridProps, chartLegendStyle } from '@/lib/chart-theme'
import { cn } from '@/lib/utils'

// ---------- types ----------

interface BranchInfo { id: string; name: string }
interface SalesRow {
  month: string; branchId: string; sales: number; cash: number; unpaid: number; enrollments: number
  newFamilies: number; trialBookings: number; trialAttended: number
}
interface TeacherRow {
  id: string; name: string; fullName: string; isActive: boolean
  sessions: number; checked: number; selfChecked: number; fbSessions: number; fbStudents: number
  photoSessions: number; attended: number; makeupTotal: number; makeupChecked: number
}
interface TeacherTotals {
  sessions: number; checked: number; selfChecked: number; otherChecked: number; unknownChecked: number
  fbSessions: number; fbStudents: number; photoSessions: number; attended: number; noFbTeachers: number; teachers: number
}
interface TeacherMonth { month: string; partial: boolean; cutoff: string; totals: TeacherTotals; teachers: TeacherRow[] }
interface SummaryData {
  generatedAt: string
  today: string
  months: string[]
  branches: BranchInfo[]
  monthly: SalesRow[]
  familiesAll: { month: string; newFamilies: number }[]
  newFamiliesInRange: number
  teacherMonths: TeacherMonth[]
}

const RANGE_OPTIONS = [
  { value: '3', label: 'ย้อนหลัง 3 เดือน + เดือนนี้' },
  { value: '6', label: 'ย้อนหลัง 6 เดือน + เดือนนี้' },
  { value: '12', label: 'ย้อนหลัง 12 เดือน + เดือนนี้' },
]
const ALL = 'all'
const n = (v: unknown) => Number(v) || 0

// ---------- page ----------

export default function SummaryPage() {
  return (
    <RoleGate roles={['super_admin']}>
      <Summary />
    </RoleGate>
  )
}

function Summary() {
  const [range, setRange] = useState('3')
  const [teacherMonth, setTeacherMonth] = useState(ALL)
  const { data, loading, reload } = useAdminJson<SummaryData>(`/api/admin/reports/summary?months=${range}`)

  const branches = useMemo(() => data?.branches ?? [], [data])
  const branchIds = useMemo(() => branches.map((b) => b.id), [branches])
  const colorOf = useCallback((id: string) => branchColor(branchIds, id), [branchIds])
  const curMonth = data?.today.slice(0, 7) ?? ''
  const monthLabel = useCallback((m: string) => thaiMonthLabel(m) + (m === curMonth ? '*' : ''), [curMonth])

  // ---- sales per month (all branches + per-branch columns) ----
  const sales = useMemo(() => {
    if (!data) return []
    const fam = new Map(data.familiesAll.map((f) => [f.month, n(f.newFamilies)]))
    return data.months.map((m) => {
      const rows = data.monthly.filter((r) => r.month === m)
      const row: Record<string, number | string> = {
        month: m, label: monthLabel(m),
        sales: 0, cash: 0, unpaid: 0, enrollments: 0, trialBookings: 0, trialAttended: 0,
        newFamilies: fam.get(m) ?? 0,
      }
      for (const r of rows) {
        for (const k of ['sales', 'cash', 'unpaid', 'enrollments', 'trialBookings', 'trialAttended'] as const) {
          row[k] = n(row[k]) + n(r[k])
        }
        row[`sales_${r.branchId}`] = n(r.sales)
      }
      return row
    })
  }, [data, monthLabel])

  const salesTotal = useMemo(() => {
    const t = { sales: 0, cash: 0, unpaid: 0, enrollments: 0, trialBookings: 0, trialAttended: 0 }
    for (const r of sales) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += n(r[k])
    return t
  }, [sales])

  // ---- teacher check-in / feedback per month ----
  const teach = useMemo(() => (data?.teacherMonths ?? []).map((tm) => ({
    month: tm.month, label: monthLabel(tm.month), ...tm.totals,
    noFb: n(tm.totals.noFbTeachers),
  })), [data, monthLabel])

  const teachTotal = useMemo(() => {
    const t = { sessions: 0, checked: 0, selfChecked: 0, fbSessions: 0, fbStudents: 0, photoSessions: 0 }
    for (const r of teach) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += n(r[k])
    return t
  }, [teach])

  // ---- per teacher (whole range or one month) ----
  const teachers = useMemo(() => {
    const src = (data?.teacherMonths ?? []).filter((tm) => teacherMonth === ALL || tm.month === teacherMonth)
    const map = new Map<string, TeacherRow>()
    for (const tm of src) {
      for (const t of tm.teachers) {
        const cur = map.get(t.id)
        if (!cur) { map.set(t.id, { ...t }); continue }
        for (const k of ['sessions', 'checked', 'selfChecked', 'fbSessions', 'fbStudents', 'photoSessions', 'attended', 'makeupTotal', 'makeupChecked'] as const) {
          cur[k] += n(t[k])
        }
      }
    }
    return Array.from(map.values()).filter((t) => t.sessions > 0 || t.makeupTotal > 0).sort((a, b) => b.sessions - a.sessions)
  }, [data, teacherMonth])

  const noFbTeachersRange = teachers.filter((t) => t.sessions > 0 && t.fbSessions === 0).length

  if (loading && !data) return <PageLoading />

  const generatedAt = data
    ? new Date(data.generatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
    : ''
  const rangeText = data ? `${thaiMonthLabel(data.months[0])} – ${thaiMonthLabel(data.months[data.months.length - 1])}` : ''
  const monthOptions = [
    { value: ALL, label: `ทั้งช่วง (${rangeText})` },
    ...(data?.months ?? []).map((m) => ({ value: m, label: thaiMonthLabel(m) + (m === curMonth ? ' (ถึงวันนี้)' : '') })),
  ]

  return (
    <div className="p-4 sm:p-6 text-base relative min-w-0">
      <LoadingOverlay show={loading && !!data} />
      <div className={cn('min-w-0', loading && data && 'pointer-events-none')}>
        <PageHeader
          title="สรุปผลย้อนหลัง"
          icon={ClipboardList}
          iconColor="text-indigo-600"
          description="ยอดขาย · ครูเช็คชื่อ · Teacher Feedback รายเดือน"
          action={
            <Button variant="outline" onClick={reload} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> รีเฟรช
            </Button>
          }
        />

        <div className="space-y-6 min-w-0">
          <StickyBar>
            <FormSelect value={range} onValueChange={setRange} options={RANGE_OPTIONS} className="w-[280px]" />
            {data && (
              <span className="text-gray-500">
                ข้อมูลสด · ดึงล่าสุด {generatedAt} น. · {rangeText} · * = ถึงวันที่ {thaiDateLabel(data.today)}
              </span>
            )}
          </StickyBar>

          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
            <KpiCard icon={Banknote} gradient="indigo" label="ยอดขาย" value={formatBaht(salesTotal.sales)} sub={`รับเงินจริง ${formatBaht(salesTotal.cash)}`} />
            <KpiCard icon={UserPlus} gradient="blue" label="ลงทะเบียน" value={`${formatNumber(salesTotal.enrollments)} รายการ`} sub={`ครอบครัวใหม่ ${formatNumber(data?.newFamiliesInRange)}`} />
            <KpiCard icon={TestTube} gradient="cyan" label="ทดลองเรียน" value={`${formatNumber(salesTotal.trialAttended)} / ${formatNumber(salesTotal.trialBookings)}`} sub="มาเรียน / จอง" />
            <KpiCard icon={CalendarCheck} gradient="emerald" label="เช็คชื่อแล้ว" value={percentText(teachTotal.checked, teachTotal.sessions)} sub={`${formatNumber(teachTotal.checked)} จาก ${formatNumber(teachTotal.sessions)} คาบ`} />
            <KpiCard icon={MessageSquare} gradient="amber" label="คาบที่มี Feedback" value={percentText(teachTotal.fbSessions, teachTotal.sessions)} sub={`${formatNumber(teachTotal.fbSessions)} คาบ · ${formatNumber(teachTotal.fbStudents)} คน`} />
            <KpiCard icon={UserX} gradient="rose" label="ครูไม่เขียน Feedback เลย" value={`${noFbTeachersRange} คน`} sub={`จาก ${teachers.filter((t) => t.sessions > 0).length} คนที่มีคาบสอน`} />
          </div>

          {/* ---------- ยอดขาย ---------- */}
          <ChartCard title="ยอดขายรายเดือน" description="แท่ง = ยอดขาย (นับตามวันลงทะเบียน) แยกสาขา · เส้น = เงินที่รับจริงในเดือนนั้น">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={sales} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="label" tick={chartAxisTick} />
                <YAxis tickFormatter={formatCompact} tick={chartAxisTick} width={48} />
                <ChartTooltip formatter={(v: number) => formatBaht(v)} />
                <Legend wrapperStyle={chartLegendStyle} />
                {branches.map((b) => (
                  <Bar key={b.id} dataKey={`sales_${b.id}`} name={b.name} stackId="s" fill={colorOf(b.id)} />
                ))}
                <Line type="linear" dataKey="cash" name="รับเงินจริง" stroke={CHART_COLORS.ink} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="ตัวเลขยอดขาย" contentClassName="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เดือน</TableHead>
                  {branches.map((b) => <TableHead key={b.id} className="text-right">{b.name}</TableHead>)}
                  <TableHead className="text-right">ยอดขายรวม</TableHead>
                  <TableHead className="text-right">รับเงินจริง</TableHead>
                  <TableHead className="text-right">ค้างชำระ</TableHead>
                  <TableHead className="text-right">ลงทะเบียน</TableHead>
                  <TableHead className="text-right">ครอบครัวใหม่</TableHead>
                  <TableHead className="text-right">ทดลอง จอง → มา</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((r) => (
                  <TableRow key={String(r.month)}>
                    <TableCell className="font-medium whitespace-nowrap">{r.label}</TableCell>
                    {branches.map((b) => <TableCell key={b.id} className="num text-right">{formatBaht(r[`sales_${b.id}`])}</TableCell>)}
                    <TableCell className="num text-right font-semibold">{formatBaht(r.sales)}</TableCell>
                    <TableCell className="num text-right">{formatBaht(r.cash)}</TableCell>
                    <TableCell className={cn('num text-right', n(r.unpaid) > 0 && 'text-orange-600')}>{formatBaht(r.unpaid)}</TableCell>
                    <TableCell className="num text-right">{formatNumber(r.enrollments)}</TableCell>
                    <TableCell className="num text-right">{formatNumber(r.newFamilies)}</TableCell>
                    <TableCell className="num text-right whitespace-nowrap">{formatNumber(r.trialBookings)} → {formatNumber(r.trialAttended)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ChartCard>

          {/* ---------- เช็คชื่อ + Feedback ---------- */}
          <ChartCard
            title="ครูเช็คชื่อ + Teacher Feedback รายเดือน"
            description="นับเฉพาะคาบเรียนปกติที่สอนไปแล้ว (ไม่รวมคาบยกเลิก) · ครูเช็คเอง = ผู้กดบันทึกเป็นบัญชีของครูคนนั้น"
          >
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={teach} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="label" tick={chartAxisTick} />
                <YAxis tick={chartAxisTick} width={40} />
                <ChartTooltip formatter={(v: number) => `${formatNumber(v)} คาบ`} />
                <Legend wrapperStyle={chartLegendStyle} />
                <Bar dataKey="sessions" name="คาบที่สอน" fill={CHART_COLORS.muted} radius={[4, 4, 0, 0]} />
                <Bar dataKey="checked" name="เช็คชื่อแล้ว" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} />
                <Bar dataKey="selfChecked" name="ครูเช็คเอง" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
                <Bar dataKey="fbSessions" name="มี Feedback" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="ตัวเลขเช็คชื่อ + Feedback" contentClassName="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เดือน</TableHead>
                  <TableHead className="text-right">คาบที่สอน</TableHead>
                  <TableHead className="text-right">เช็คชื่อแล้ว</TableHead>
                  <TableHead className="text-center">% เช็ค</TableHead>
                  <TableHead className="text-right">ครูเช็คเอง</TableHead>
                  <TableHead className="text-center">% ครูเช็คเอง</TableHead>
                  <TableHead className="text-right">คาบมี Feedback</TableHead>
                  <TableHead className="text-center">% Feedback</TableHead>
                  <TableHead className="text-right">มีรูป</TableHead>
                  <TableHead className="text-right">ครูไม่เขียนเลย</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teach.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium whitespace-nowrap">{r.label}</TableCell>
                    <TableCell className="num text-right">{formatNumber(r.sessions)}</TableCell>
                    <TableCell className="num text-right">{formatNumber(r.checked)}</TableCell>
                    <RateCell value={n(r.checked)} total={n(r.sessions)} />
                    <TableCell className="num text-right">{formatNumber(r.selfChecked)}</TableCell>
                    <RateCell value={n(r.selfChecked)} total={n(r.sessions)} />
                    <TableCell className="num text-right">{formatNumber(r.fbSessions)}</TableCell>
                    <RateCell value={n(r.fbSessions)} total={n(r.sessions)} />
                    <TableCell className="num text-right">{formatNumber(r.photoSessions)}</TableCell>
                    <TableCell className="num text-right">{r.noFb} / {formatNumber(r.teachers)} คน</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ChartCard>

          <ChartCard
            title="รายครู"
            description="เรียงตามจำนวนคาบที่สอน · ต้องคุย = สอน 10 คาบขึ้นไปแต่เช็คชื่อไม่ถึง 25% · เขียนประจำ = มี Feedback ตั้งแต่ 25% ของคาบ"
            action={<FormSelect value={teacherMonth} onValueChange={setTeacherMonth} options={monthOptions} className="w-[240px]" />}
            contentClassName="overflow-x-auto"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ครู</TableHead>
                  <TableHead className="text-right">คาบที่สอน</TableHead>
                  <TableHead className="text-right">เช็คแล้ว</TableHead>
                  <TableHead className="text-center">% เช็ค</TableHead>
                  <TableHead className="text-right">เช็คเอง</TableHead>
                  <TableHead className="text-center">% เช็คเอง</TableHead>
                  <TableHead className="text-right">คาบมี Feedback</TableHead>
                  <TableHead className="text-center">% Feedback</TableHead>
                  <TableHead className="text-right">เด็กได้ Feedback</TableHead>
                  <TableHead className="text-right">ชดเชย เช็ค/ทั้งหมด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((t) => {
                  const mustTalk = t.sessions >= 10 && t.checked / t.sessions < 0.25
                  const goodFb = t.sessions > 0 && t.fbSessions / t.sessions >= 0.25
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-medium">{t.name}</span>
                        {mustTalk && <Pill tone="red" className="ml-2">ต้องคุย</Pill>}
                        {goodFb && <Pill tone="emerald" className="ml-2">เขียนประจำ</Pill>}
                      </TableCell>
                      <TableCell className="num text-right">{formatNumber(t.sessions)}</TableCell>
                      <TableCell className="num text-right">{formatNumber(t.checked)}</TableCell>
                      <RateCell value={t.checked} total={t.sessions} />
                      <TableCell className="num text-right">{formatNumber(t.selfChecked)}</TableCell>
                      <RateCell value={t.selfChecked} total={t.sessions} />
                      <TableCell className="num text-right">{formatNumber(t.fbSessions)}</TableCell>
                      <RateCell value={t.fbSessions} total={t.sessions} />
                      <TableCell className="num text-right">{formatNumber(t.fbStudents)}</TableCell>
                      <TableCell className="num text-right">{formatNumber(t.makeupChecked)} / {formatNumber(t.makeupTotal)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
