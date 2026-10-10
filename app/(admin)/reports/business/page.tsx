'use client'

// รายงานผู้บริหาร (super_admin เท่านั้น — เมนูกลุ่ม "ผู้บริหาร") — ยอดขาย/เงินรับจริงรายเดือนแยกสาขา,
// ยอดรวมแต่ละสาขา (ยอดขาย = เก็บแล้ว + ค้างชำระ + ยังไม่ได้ลงยอด), ลูกค้าใหม่ vs เก่า,
// conversion ทดลองเรียน → สมัครคอร์ส, คอร์สขายดี, การเช็คชื่อ และ Teacher Feedback รายเดือน
// ข้อมูลมาจาก RPC get_business_dashboard ผ่าน /api/admin/reports/business (1 query)
// คำนวณสดทุกครั้งที่เปิด/กดรีเฟรช — ไม่มี cache ไม่ต้องพึ่ง cron

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from 'recharts'
import { BarChart3, Banknote, CalendarCheck, MessageSquare, RefreshCw, TestTube, UserPlus } from 'lucide-react'
import { useAdminJson } from '@/hooks/useAdminJson'
import { RoleGate } from '@/components/auth/role-gate'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { FormSelect } from '@/components/ui/form-select'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { PageLoading } from '@/components/ui/loading'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { StickyBar } from '@/components/ui/sticky-bar'
import { KpiCard } from '@/components/ui/kpi-card'
import { ChartCard } from '@/components/ui/chart-card'
import { RateCell } from '@/components/ui/rate-cell'
import { ExecutiveClasses, type ClassesData } from '@/components/reports/executive-classes'
import { ExecutiveFollowups } from '@/components/reports/executive-followups'
import {
  addMonthsYm, bangkokMonth, formatBaht, formatCompact, formatNumber, percent, percentText, thaiMonthLabel,
} from '@/lib/format'
import { BRANCH_COLORS, CHART_COLORS, branchColor, chartAxisTick, chartGridProps, chartLegendStyle } from '@/lib/chart-theme'
import { cn } from '@/lib/utils'

// ---------- types ----------

interface BranchInfo { id: string; name: string }

interface MonthRow {
  month: string
  branchId: string
  enrollments: number
  sales: number
  cash: number
  collected: number
  unpaid: number
  unrecorded: number
  unrecordedCount: number
  newFamilies: number
  returningFamilies: number
  trialBookings: number
  trialAttended: number
  trialConverted: number
  trialNoShow: number
  sessions: number
  checked: number
  attended: number
  feedback: number
}

interface FamiliesAllRow { month: string; newFamilies: number; returningFamilies: number }
interface CourseRow { branchId: string; subject: string; enrollments: number; sales: number }
interface TeacherRow { month: string; branchId: string; teacherId: string; nickname: string; isActive: boolean; attended: number; feedback: number; photos: number }

interface DashboardData extends ClassesData {
  generatedAt: string
  from: string
  to: string
  today: string
  branches: BranchInfo[]
  monthly: MonthRow[]
  /** ครอบครัวใหม่/เก่ารวมทุกสาขา นับครอบครัวละครั้ง (บวกจาก monthly จะนับซ้ำข้ามสาขา) */
  familiesAll: FamiliesAllRow[]
  newFamiliesInRange: number
  courses: CourseRow[]
  teachers: TeacherRow[]
}

type Totals = Omit<MonthRow, 'month' | 'branchId'>

// ---------- helpers ----------

const ALL = 'all'
const FIRST_MONTH = '2025-07' // เดือนแรกที่มีข้อมูลในระบบ
/** ระบบ Teacher Feedback เริ่มใช้เดือนนี้ — เดือนก่อนหน้าเป็น 0% ทุกคน ไม่ใช่ครูไม่เขียน จึงไม่แสดง */
const FEEDBACK_START = '2026-06'

const ZERO: Totals = {
  enrollments: 0, sales: 0, cash: 0, collected: 0, unpaid: 0, unrecorded: 0, unrecordedCount: 0,
  newFamilies: 0, returningFamilies: 0, trialBookings: 0, trialAttended: 0, trialConverted: 0, trialNoShow: 0,
  sessions: 0, checked: 0, attended: 0, feedback: 0,
}

function sumRows(rows: MonthRow[]): Totals {
  const t = { ...ZERO }
  for (const r of rows) for (const k of Object.keys(ZERO) as (keyof Totals)[]) t[k] += Number(r[k]) || 0
  return t
}

type PeriodKey = 'last12' | 'last6' | 'thisYear' | 'lastYear' | 'all'

function periodRange(key: PeriodKey): { from: string; to: string } {
  const cur = bangkokMonth()
  const y = +cur.slice(0, 4)
  switch (key) {
    case 'last6': return { from: addMonthsYm(cur, -5), to: cur }
    case 'thisYear': return { from: `${y}-01`, to: cur }
    case 'lastYear': return { from: `${y - 1}-01`, to: `${y - 1}-12` }
    case 'all': return { from: FIRST_MONTH, to: cur }
    default: return { from: addMonthsYm(cur, -11), to: cur }
  }
}

function periodOptions() {
  const y = +bangkokMonth().slice(0, 4)
  return [
    { value: 'last12', label: '12 เดือนล่าสุด' },
    { value: 'last6', label: '6 เดือนล่าสุด' },
    { value: 'thisYear', label: `ปีนี้ (${y + 543})` },
    { value: 'lastYear', label: `ปีที่แล้ว (${y + 542})` },
    { value: 'all', label: 'ทั้งหมดตั้งแต่เริ่มใช้ระบบ' },
  ]
}

/** ยอด "สถานะชำระแล้วแต่ไม่ได้ลงยอด" — ลิงก์ไปหน้ารายการ /reports/payment-gaps */
function UnrecordedCell({ amount, count }: { amount: number; count: number }) {
  if (!amount) return <TableCell className="num text-right">{formatBaht(0)}</TableCell>
  return (
    <TableCell className="num text-right">
      <Link href="/reports/payment-gaps" className="text-orange-600 underline underline-offset-2 hover:text-orange-700">
        {formatBaht(amount)}
      </Link>
      <div className="text-gray-500">{count} รายการ</div>
    </TableCell>
  )
}

function BranchDot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-sm mr-2 shrink-0" style={{ backgroundColor: color }} />
}

// ---------- page ----------

export default function BusinessDashboardPage() {
  return (
    <RoleGate roles={['super_admin']}>
      <BusinessDashboard />
    </RoleGate>
  )
}

function BusinessDashboard() {
  const [period, setPeriod] = useState<PeriodKey>('last12')
  const [branch, setBranch] = useState<string>(ALL)
  const { from, to } = periodRange(period)
  const { data, loading, reload } = useAdminJson<DashboardData>(
    `/api/admin/reports/business?${new URLSearchParams({ from, to })}`,
  )

  const branches = useMemo(() => data?.branches ?? [], [data])
  const branchIds = useMemo(() => branches.map((b) => b.id), [branches])
  const colorOf = useCallback((id: string) => branchColor(branchIds, id), [branchIds])
  const curMonth = data?.today.slice(0, 7) ?? ''
  const isAll = branch === ALL

  // ครอบครัวรวมทุกสาขา (นับครอบครัวละครั้ง) — ใช้แทนผลบวกรายสาขาเมื่อดู "ทุกสาขา"
  const famAll = useMemo(() => new Map((data?.familiesAll ?? []).map((f) => [f.month, f])), [data])

  const scoped = useMemo(
    () => (data?.monthly ?? []).filter((r) => isAll || r.branchId === branch),
    [data, branch, isAll],
  )
  const months = useMemo(() => Array.from(new Set((data?.monthly ?? []).map((r) => r.month))).sort(), [data])

  const totals = useMemo(() => {
    const t = sumRows(scoped)
    if (isAll && data) t.newFamilies = data.newFamiliesInRange
    return t
  }, [scoped, isAll, data])

  const byMonth = useMemo(() => months.map((m) => {
    const rows = scoped.filter((r) => r.month === m)
    const t = sumRows(rows)
    if (isAll) {
      const f = famAll.get(m)
      t.newFamilies = f?.newFamilies ?? 0
      t.returningFamilies = f?.returningFamilies ?? 0
    }
    const perBranch: Record<string, number> = {}
    for (const r of rows) perBranch[`sales_${r.branchId}`] = Number(r.sales)
    return {
      month: m,
      label: thaiMonthLabel(m) + (m === curMonth ? '*' : ''),
      ...t,
      ...perBranch,
      conversion: percent(t.trialConverted, t.trialAttended),
      checkRate: percent(t.checked, t.sessions),
      feedbackRate: percent(t.feedback, t.attended),
    }
  }), [months, scoped, curMonth, isAll, famAll])

  const branchSummary = useMemo(() => branches.map((b) => ({
    ...b,
    t: sumRows((data?.monthly ?? []).filter((r) => r.branchId === b.id)),
  })), [branches, data])
  const grand = useMemo(() => {
    const t = sumRows(data?.monthly ?? [])
    if (data) t.newFamilies = data.newFamiliesInRange
    return t
  }, [data])

  const courses = useMemo(() => {
    const map = new Map<string, { subject: string; enrollments: number; sales: number }>()
    for (const c of data?.courses ?? []) {
      if (!isAll && c.branchId !== branch) continue
      const x = map.get(c.subject) ?? { subject: c.subject, enrollments: 0, sales: 0 }
      x.enrollments += Number(c.enrollments)
      x.sales += Number(c.sales)
      map.set(c.subject, x)
    }
    const list = Array.from(map.values()).filter((c) => c.sales > 0).sort((a, b) => b.sales - a.sales)
    const total = list.reduce((a, c) => a + c.sales, 0)
    const max = list[0]?.sales ?? 1
    return list.map((c) => ({ ...c, share: total ? c.sales / total : 0, bar: c.sales / max }))
  }, [data, branch, isAll])

  // ครู × เดือน (เฉพาะเดือนที่มีการเช็คชื่อ) — ไม่แสดงครูที่ลาออกแล้ว (teachers.is_active=false)
  // และเดือนก่อนเริ่มใช้ระบบ feedback (FEEDBACK_START)
  const teacherGrid = useMemo(() => {
    const rows = (data?.teachers ?? []).filter((t) =>
      t.isActive !== false && t.month >= FEEDBACK_START && (isAll || t.branchId === branch))
    const tMonths = Array.from(new Set(rows.map((r) => r.month))).sort()
    const map = new Map<string, { nickname: string; attended: number; feedback: number; photos: number; m: Record<string, { a: number; f: number }> }>()
    for (const r of rows) {
      const x = map.get(r.teacherId) ?? { nickname: r.nickname, attended: 0, feedback: 0, photos: 0, m: {} }
      x.attended += r.attended
      x.feedback += r.feedback
      x.photos += r.photos
      const cell = x.m[r.month] ?? { a: 0, f: 0 }
      cell.a += r.attended
      cell.f += r.feedback
      x.m[r.month] = cell
      map.set(r.teacherId, x)
    }
    const list = Array.from(map, ([id, v]) => ({ id, ...v })).sort(
      (a, b) => b.feedback / Math.max(1, b.attended) - a.feedback / Math.max(1, a.attended) || b.attended - a.attended,
    )
    return { months: tMonths, list }
  }, [data, branch, isAll])

  if (loading && !data) return <PageLoading />

  const generatedAt = data ? new Date(data.generatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : ''
  const showBranchColumns = isAll && branches.length > 1
  const rangeText = data ? `${thaiMonthLabel(data.from)} – ${thaiMonthLabel(data.to)}` : ''

  return (
    <div className="p-4 sm:p-6 text-base relative min-w-0">
      <LoadingOverlay show={loading && !!data} />
      <div className={cn('min-w-0', loading && data && 'pointer-events-none')}>
        <PageHeader
          title="รายงานผู้บริหาร"
          icon={BarChart3}
          iconColor="text-indigo-600"
          description="ยอดขาย ลูกค้าใหม่ conversion และคุณภาพการสอน แยกสาขา รายเดือน"
          action={
            <Button variant="outline" onClick={reload} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> รีเฟรช
            </Button>
          }
        />

        <div className="space-y-6 min-w-0">
          {/* ตัวกรอง — ติดขอบบน เลื่อนลงไปดูกราฟแล้วยังสลับสาขาได้ */}
          <StickyBar>
            <FormSelect value={period} onValueChange={(v) => setPeriod(v as PeriodKey)} options={periodOptions()} className="w-[240px]" />
            <Tabs value={branch} onValueChange={setBranch}>
              <TabsList>
                <TabsTrigger value={ALL} className="text-base px-4">ทุกสาขา</TabsTrigger>
                {branches.map((b) => (
                  <TabsTrigger key={b.id} value={b.id} className="text-base px-4">
                    <BranchDot color={colorOf(b.id)} />
                    {b.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {data && (
              <span className="text-gray-500 basis-full">
                ข้อมูลสดจากระบบ · ดึงล่าสุด {generatedAt} น. · {rangeText}
              </span>
            )}
          </StickyBar>

          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
            <KpiCard icon={Banknote} gradient="indigo" label="ยอดขาย" value={formatBaht(totals.sales)} sub={`รับเงินจริง ${formatBaht(totals.cash)}`} />
            <KpiCard icon={UserPlus} gradient="blue" label="ลงทะเบียน (รายการ)" value={formatNumber(totals.enrollments)} sub={`ครอบครัวใหม่ ${formatNumber(totals.newFamilies)}`} />
            <KpiCard icon={TestTube} gradient="violet" label="Conversion" value={percentText(totals.trialConverted, totals.trialAttended)} sub={`สมัคร ${totals.trialConverted} / มาเรียน ${totals.trialAttended} คน`} />
            <KpiCard icon={TestTube} gradient="cyan" label="จองทดลองเรียน" value={formatNumber(totals.trialBookings)} sub={`ไม่มาตามนัด ${totals.trialNoShow} คน`} />
            <KpiCard icon={CalendarCheck} gradient="amber" label="เช็คชื่อแล้ว" value={percentText(totals.checked, totals.sessions)} sub={`${formatNumber(totals.checked)} / ${formatNumber(totals.sessions)} คาบ`} />
            <KpiCard icon={MessageSquare} gradient="emerald" label="เขียน Feedback" value={percentText(totals.feedback, totals.attended)} sub={`${formatNumber(totals.feedback)} / ${formatNumber(totals.attended)} ครั้ง`} />
          </div>

          {/* งานติดตามลูกค้า — ยังไม่ติดต่อกี่คน (CEO ตามทีม) */}
          <ExecutiveFollowups branch={branch} />

          {/* ยอดรวมแต่ละสาขา */}
          <ChartCard
            title="ยอดรวมแต่ละสาขา"
            description={`คอร์สที่ลงทะเบียนในช่วง ${rangeText} · ยอดขาย = เก็บแล้ว + ค้างชำระ + ยังไม่ได้ลงยอด`}
            contentClassName="overflow-x-auto"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[130px]">สาขา</TableHead>
                  <TableHead className="text-right">ยอดขาย</TableHead>
                  <TableHead className="text-right">เก็บแล้ว</TableHead>
                  <TableHead className="text-right">ค้างชำระ</TableHead>
                  <TableHead className="text-right">ยังไม่ได้ลงยอด</TableHead>
                  <TableHead className="text-right">ลงทะเบียน</TableHead>
                  <TableHead className="text-right">ครอบครัวใหม่</TableHead>
                  <TableHead className="text-right">ทดลอง (มา)</TableHead>
                  <TableHead className="text-right">สมัคร</TableHead>
                  <TableHead className="text-center">Conversion</TableHead>
                  <TableHead className="text-center">เช็คชื่อ</TableHead>
                  <TableHead className="text-center">Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchSummary.map(({ id, name, t }) => (
                  <TableRow key={id}>
                    <TableCell className="font-medium"><span className="inline-flex items-center"><BranchDot color={colorOf(id)} />{name}</span></TableCell>
                    <TableCell className="num text-right">{formatBaht(t.sales)}</TableCell>
                    <TableCell className="num text-right">{formatBaht(t.collected)}</TableCell>
                    <TableCell className={cn('num text-right', t.unpaid > 0 && 'text-red-600')}>{formatBaht(t.unpaid)}</TableCell>
                    <UnrecordedCell amount={t.unrecorded} count={t.unrecordedCount} />
                    <TableCell className="num text-right">{formatNumber(t.enrollments)}</TableCell>
                    <TableCell className="num text-right">{formatNumber(t.newFamilies)}</TableCell>
                    <TableCell className="num text-right">{t.trialAttended}</TableCell>
                    <TableCell className="num text-right">{t.trialConverted}</TableCell>
                    <RateCell value={t.trialConverted} total={t.trialAttended} />
                    <RateCell value={t.checked} total={t.sessions} />
                    <RateCell value={t.feedback} total={t.attended} />
                  </TableRow>
                ))}
                {branchSummary.length > 1 && (
                  <TableRow className="font-semibold bg-gray-50">
                    <TableCell>รวมทุกสาขา</TableCell>
                    <TableCell className="num text-right">{formatBaht(grand.sales)}</TableCell>
                    <TableCell className="num text-right">{formatBaht(grand.collected)}</TableCell>
                    <TableCell className="num text-right">{formatBaht(grand.unpaid)}</TableCell>
                    <UnrecordedCell amount={grand.unrecorded} count={grand.unrecordedCount} />
                    <TableCell className="num text-right">{formatNumber(grand.enrollments)}</TableCell>
                    <TableCell className="num text-right">{formatNumber(grand.newFamilies)}</TableCell>
                    <TableCell className="num text-right">{grand.trialAttended}</TableCell>
                    <TableCell className="num text-right">{grand.trialConverted}</TableCell>
                    <RateCell value={grand.trialConverted} total={grand.trialAttended} />
                    <RateCell value={grand.checked} total={grand.sessions} />
                    <RateCell value={grand.feedback} total={grand.attended} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ChartCard>

          {/* ยอดขายรายเดือน */}
          <ChartCard title="ยอดขายรายเดือน" description="แท่ง = ยอดขายตามวันลงทะเบียน (แยกสีตามสาขา) · เส้น = เงินที่รับจริงในเดือนนั้น · * = เดือนที่ยังไม่จบ">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={byMonth} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="label" tick={chartAxisTick} />
                <YAxis tickFormatter={formatCompact} tick={chartAxisTick} width={48} />
                <ChartTooltip formatter={(v: number) => formatBaht(v)} />
                <Legend wrapperStyle={chartLegendStyle} />
                {showBranchColumns
                  ? branches.map((b) => (
                    <Bar key={b.id} dataKey={`sales_${b.id}`} name={b.name} stackId="s" fill={colorOf(b.id)} />
                  ))
                  : <Bar dataKey="sales" name="ยอดขาย" fill={isAll ? BRANCH_COLORS[0] : colorOf(branch)} radius={[4, 4, 0, 0]} />}
                <Line type="linear" dataKey="cash" name="รับเงินจริง" stroke={CHART_COLORS.ink} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartCard title="Conversion ทดลองเรียน → สมัครคอร์ส" description="นับตามเดือนที่มาทดลองเรียน · สมัคร = ครอบครัวนั้นลงคอร์สใดก็ได้ในวันทดลองหรือหลังจากนั้น">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={byMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="label" tick={chartAxisTick} />
                  <YAxis yAxisId="n" tick={chartAxisTick} width={36} allowDecimals={false} />
                  <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={chartAxisTick} width={44} />
                  <ChartTooltip formatter={(v: number, name: string) => (name === 'Conversion' ? `${v}%` : `${v} คน`)} />
                  <Legend wrapperStyle={chartLegendStyle} />
                  <Bar yAxisId="n" dataKey="trialAttended" name="มาทดลองเรียน" fill={CHART_COLORS.indigoSoft} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="n" dataKey="trialConverted" name="สมัครคอร์ส" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="p" type="linear" dataKey="conversion" name="Conversion" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="ลูกค้าใหม่ vs ลูกค้าเก่า" description="จำนวนครอบครัวที่ลงคอร์สในเดือนนั้น · ใหม่ = ลงคอร์สครั้งแรก · เส้น = จองทดลองเรียน">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={byMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="label" tick={chartAxisTick} />
                  <YAxis tick={chartAxisTick} width={36} allowDecimals={false} />
                  <ChartTooltip />
                  <Legend wrapperStyle={chartLegendStyle} />
                  <Bar dataKey="newFamilies" name="ครอบครัวใหม่" stackId="f" fill={CHART_COLORS.green} />
                  <Bar dataKey="returningFamilies" name="ลูกค้าเก่าลงต่อ" stackId="f" fill={CHART_COLORS.muted} radius={[4, 4, 0, 0]} />
                  <Line type="linear" dataKey="trialBookings" name="จองทดลองเรียน" stroke={CHART_COLORS.cyan} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* คลาสเรียน — snapshot วันนี้ + เปิดใหม่/เต็มห้อง/เรียนต่อ รายเดือน */}
          {data && (
            <ExecutiveClasses
              data={data}
              branch={branch}
              branchName={(id) => branches.find((b) => b.id === id)?.name ?? ''}
              months={months}
              today={data.today}
            />
          )}

          {/* ตารางรายเดือน */}
          <ChartCard
            title="ตัวเลขรายเดือน"
            description={`${isAll ? 'ทุกสาขา' : branches.find((b) => b.id === branch)?.name ?? ''} · เดือนล่าสุดอยู่บนสุด`}
            contentClassName="overflow-x-auto"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เดือน</TableHead>
                  {showBranchColumns && branches.map((b) => (
                    <TableHead key={b.id} className="text-right">ยอด {b.name}</TableHead>
                  ))}
                  <TableHead className="text-right">ยอดขาย{showBranchColumns && 'รวม'}</TableHead>
                  <TableHead className="text-right">รับเงินจริง</TableHead>
                  <TableHead className="text-right">ลงทะเบียน</TableHead>
                  <TableHead className="text-right">ครอบครัวใหม่</TableHead>
                  <TableHead className="text-right">ลูกค้าเก่า</TableHead>
                  <TableHead className="text-right">ทดลอง (มา)</TableHead>
                  <TableHead className="text-right">สมัคร</TableHead>
                  <TableHead className="text-center">Conversion</TableHead>
                  <TableHead className="text-center">เช็คชื่อ</TableHead>
                  <TableHead className="text-center">Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...byMonth].reverse().map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium whitespace-nowrap">{r.label}</TableCell>
                    {showBranchColumns && branches.map((b) => (
                      <TableCell key={b.id} className="num text-right">
                        {formatBaht(Number((r as Record<string, unknown>)[`sales_${b.id}`] ?? 0))}
                      </TableCell>
                    ))}
                    <TableCell className="num text-right font-medium">{formatBaht(r.sales)}</TableCell>
                    <TableCell className="num text-right">{formatBaht(r.cash)}</TableCell>
                    <TableCell className="num text-right">{r.enrollments}</TableCell>
                    <TableCell className="num text-right">{r.newFamilies}</TableCell>
                    <TableCell className="num text-right">{r.returningFamilies}</TableCell>
                    <TableCell className="num text-right">{r.trialAttended}</TableCell>
                    <TableCell className="num text-right">{r.trialConverted}</TableCell>
                    <RateCell value={r.trialConverted} total={r.trialAttended} />
                    <RateCell value={r.checked} total={r.sessions} />
                    <RateCell value={r.feedback} total={r.attended} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ChartCard>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* คอร์สขายดี */}
            <ChartCard title="คอร์สขายดี" description="ตามวันลงทะเบียนในช่วงที่เลือก เรียงตามยอดขาย" contentClassName="overflow-x-auto max-h-[480px] overflow-y-auto">
              {courses.length === 0 ? (
                <EmptyState icon={BarChart3} title="ไม่มียอดขายในช่วงนี้" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>คอร์ส</TableHead>
                      <TableHead className="text-right">คน</TableHead>
                      <TableHead className="text-right min-w-[170px]">ยอดขาย</TableHead>
                      <TableHead className="text-right">สัดส่วน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map((c) => (
                      <TableRow key={c.subject}>
                        <TableCell>{c.subject}</TableCell>
                        <TableCell className="num text-right">{c.enrollments}</TableCell>
                        <TableCell className="num text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-2 rounded-full bg-indigo-400" style={{ width: `${Math.max(3, c.bar * 64)}px` }} />
                            {formatBaht(c.sales)}
                          </div>
                        </TableCell>
                        <TableCell className="num text-right">{(c.share * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ChartCard>

            {/* เช็คชื่อ + feedback */}
            <ChartCard title="เช็คชื่อ & Feedback" description="เช็คชื่อ = % คาบที่ถึงวันเรียนแล้วและเช็คชื่อ · Feedback = % ครั้งที่เด็กมาเรียนแล้วครูเขียน feedback">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={byMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="label" tick={chartAxisTick} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={chartAxisTick} width={44} />
                  <ChartTooltip formatter={(v: number) => `${v}%`} />
                  <Legend wrapperStyle={chartLegendStyle} />
                  <Line type="linear" dataKey="checkRate" name="เช็คชื่อ" stroke={CHART_COLORS.amber} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="linear" dataKey="feedbackRate" name="Feedback" stroke={CHART_COLORS.green} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Feedback ครูรายเดือน */}
          <ChartCard
            title="Feedback ครูรายเดือน"
            description="% ของครั้งที่เด็กมาเรียน (มา/สาย) ที่ครูเขียน feedback · นับคนที่สอนจริง (รวมสอนแทน) · เฉพาะครูที่ยังทำงานอยู่ ตั้งแต่ มิ.ย. 69 (เริ่มใช้ระบบ feedback) · – = ไม่มีคาบที่เช็คชื่อในเดือนนั้น"
            contentClassName="overflow-x-auto"
          >
            {teacherGrid.list.length === 0 ? (
              <EmptyState icon={MessageSquare} title="ยังไม่มีข้อมูลการเช็คชื่อในช่วงนี้" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[110px]">ครู</TableHead>
                    {teacherGrid.months.map((m) => (
                      <TableHead key={m} className="text-center whitespace-nowrap">{thaiMonthLabel(m)}</TableHead>
                    ))}
                    <TableHead className="text-center">รวม</TableHead>
                    <TableHead className="text-right">เขียน / มาเรียน</TableHead>
                    <TableHead className="text-right">แนบรูป</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacherGrid.list.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nickname}</TableCell>
                      {teacherGrid.months.map((m) => (
                        <RateCell key={m} value={t.m[m]?.f ?? 0} total={t.m[m]?.a ?? 0} />
                      ))}
                      <RateCell value={t.feedback} total={t.attended} />
                      <TableCell className="num text-right">{t.feedback} / {t.attended}</TableCell>
                      <TableCell className="num text-right">{t.photos}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ChartCard>

          {/* วิธีนับ */}
          <Card>
            <CardContent className="pt-6 text-gray-600 space-y-1.5">
              <p className="font-medium text-gray-800">วิธีนับตัวเลข</p>
              <p>• <b>ยอดขาย</b> = ราคาหลังส่วนลดของการลงทะเบียน นับตามวันลงทะเบียน ไม่รวมรายการที่ยกเลิก แบ่งเป็น <b>เก็บแล้ว</b> + <b>ค้างชำระ</b> + <b>ยังไม่ได้ลงยอด</b> (สถานะชำระแล้วแต่ยอดเงินในระบบไม่ครบ ดูรายการได้ที่เมนู &quot;ยอดที่ยังไม่ได้ลง&quot;)</p>
              <p>• <b>รับเงินจริง</b> (เส้นในกราฟ) = เงินที่บันทึกรับในเดือนนั้น ไม่ว่าลงทะเบียนเดือนไหน จึงไม่เท่ากับ &quot;เก็บแล้ว&quot; ของเดือนเดียวกัน</p>
              <p>• <b>ครอบครัวใหม่</b> = ผู้ปกครองที่ลงคอร์สครั้งแรกในเดือนนั้น (ดูทุกสาขา นับครอบครัวละครั้ง แม้ลงหลายสาขา) · <b>ลูกค้าเก่า</b> = เคยลงคอร์สมาก่อนแล้ว</p>
              <p>• <b>Conversion</b> = มาทดลองเรียนแล้วครอบครัวนั้น (จับคู่ด้วยเบอร์โทร) ลงคอร์สใดก็ได้ในวันทดลองหรือหลังจากนั้น หรือแอดมินกด &quot;ปิดการขาย&quot; ไว้ — เดือนล่าสุดตัวเลขจะค่อย ๆ ขึ้น เพราะบางคนสมัครหลังทดลองหลายสัปดาห์</p>
              <p>• <b>คลาส</b>: นักเรียน = การลงทะเบียนที่ไม่ยกเลิกจริง · เปิดใหม่ = ตามวันเริ่มคลาส · <b>เต็มห้อง</b> = นักเรียน ÷ ที่นั่ง · <b>เรียนต่อ</b> = เด็กที่จบคลาสในเดือนนั้นแล้วลงคลาสอื่นที่เริ่มภายใน 30 วันก่อน – 60 วันหลังวันจบ · กำลังเรียน/กำลังจะเริ่ม/จบเดือนนี้ = ดู ณ วันนี้ ไม่ขึ้นกับช่วงที่เลือก · <b>ยอดขายต่อคลาส</b> = ยอดลงทะเบียนของคลาสที่เปิดเดือนนั้น ÷ จำนวนคลาส · <b>รายได้ล่วงหน้า</b> = ยอดลงทะเบียนของคลาสที่ยังไม่เริ่ม · <b>เด็กเสี่ยงเลิกเรียน</b> = ไม่ได้มาเรียน (ขาด/ลา/ป่วย) ติดกันตั้งแต่ 2 คาบล่าสุดที่เช็คชื่อ — คาบที่ไม่ได้เช็คชื่อไม่นับ</p>
              <p>• <b>เช็คชื่อ / Feedback</b> นับเฉพาะคาบที่ถึงวันเรียนแล้ว ถ้าครูไม่เช็คชื่อ คาบนั้นจะไม่ถูกนับใน Feedback</p>
              <p>• ข้อมูลก่อน มิ.ย. 69 บันทึกไม่ครบ ใช้เทียบได้คร่าว ๆ · ตัวเลขคำนวณสดทุกครั้งที่เปิดหน้าหรือกดรีเฟรช</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
