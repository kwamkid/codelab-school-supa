'use client'

// ส่วน "คลาสเรียน" ในรายงานผู้บริหาร (/reports/business)
//  • snapshot วันนี้: กำลังเรียน / กำลังจะเริ่ม (60 วัน) / จบเดือนนี้
//  • คลาสเปิดใหม่รายเดือน (ตาม start_date) + อัตราเต็มห้อง, เทียบเดือนก่อน & เดือนเดียวกันปีก่อน
//  • อัตราเรียนต่อ: เด็กที่จบคลาสในเดือนนั้น ลงคลาสถัดไป (เริ่มภายใน -30/+60 วันจากวันจบ)
//  • ยอดขายต่อคลาส (ตามเดือนที่เปิด) · รายได้ล่วงหน้า (คลาสที่ยังไม่เริ่ม)
//  • เด็กเสี่ยงเลิกเรียน: ไม่ได้มาเรียนติดกัน ≥2 ครั้งล่าสุดที่เช็คชื่อ (คลาสที่กำลังเรียน)
// ข้อมูลมาจาก get_business_dashboard (classesMonthly / continuation / classesActive /
// classesUpcoming / classesEndingThisMonth) — กรองสาขาตามแท็บที่เลือกในหน้า

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from 'recharts'
import { CalendarClock, CalendarX2, PiggyBank, Repeat, School, TrendingUp, UserX } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { KpiCard } from '@/components/ui/kpi-card'
import { ChartCard } from '@/components/ui/chart-card'
import { Pill } from '@/components/ui/pill'
import { Button } from '@/components/ui/button'
import { addMonthsYm, formatBaht, formatCompact, percent, percentText, thaiDateLabel, thaiMonthLabel } from '@/lib/format'
import { CHART_COLORS, chartAxisTick, chartGridProps, chartLegendStyle } from '@/lib/chart-theme'
import { getShortDayName } from '@/lib/utils'

export interface ClassItem {
  id: string
  code: string
  subject: string
  branchId: string
  status: string
  startDate: string
  endDate: string
  startTime: string | null
  endTime: string | null
  daysOfWeek: number[] | null
  teacher: string | null
  students: number
  maxStudents: number | null
  minStudents: number | null
}

export interface AtRiskStudent {
  enrollmentId: string
  studentId: string
  branchId: string
  studentName: string
  studentNickname: string | null
  parentName: string | null
  parentPhone: string | null
  classId: string
  subject: string
  teacher: string | null
  /** ครั้งล่าสุดที่ไม่ได้มาเรียนติดกัน (นับเฉพาะคาบที่เช็คชื่อแล้ว) */
  streak: number
  absent: number
  /** ลา/ป่วย ในช่วงที่ขาดติดกัน */
  excused: number
  lastPresent: string | null
  lastChecked: string
}

export interface ClassesData {
  classesMonthly: { month: string; branchId: string; opened: number; students: number; seats: number; revenue: number }[]
  atRiskStudents: AtRiskStudent[]
  forwardRevenue: { branchId: string; classes: number; enrollments: number; sales: number; collected: number }[]
  continuation: { month: string; branchId: string; finished: number; continued: number }[]
  classesActive: { branchId: string; classes: number; students: number; seats: number }[]
  classesUpcoming: ClassItem[]
  classesEndingThisMonth: ClassItem[]
}

interface Props {
  data: ClassesData
  /** 'all' หรือ branch id */
  branch: string
  branchName: (id: string) => string
  /** เดือนในช่วงที่เลือก (เรียงเก่า→ใหม่) */
  months: string[]
  today: string
}

/** % เปลี่ยนแปลง a เทียบ b → '+25%' / '−10%' / '—' */
function change(a: number, b: number): { text: string; up: boolean | null } {
  if (!b) return { text: a ? 'ใหม่' : '—', up: a ? true : null }
  const p = Math.round(((a - b) / b) * 100)
  return { text: `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%`, up: p === 0 ? null : p > 0 }
}

function daysText(days: number[] | null): string {
  if (!days?.length) return ''
  return [...days].sort((a, b) => a - b).map((d) => getShortDayName(d)).join(' ')
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
}

export function ExecutiveClasses({ data, branch, branchName, months, today }: Props) {
  const router = useRouter()
  const isAll = branch === 'all'
  const inScope = <T extends { branchId: string }>(rows: T[]) => (isAll ? rows : rows.filter((r) => r.branchId === branch))

  const active = useMemo(() => inScope(data.classesActive).reduce(
    (a, r) => ({ classes: a.classes + r.classes, students: a.students + r.students, seats: a.seats + r.seats }),
    { classes: 0, students: 0, seats: 0 },
  ), [data, branch]) // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = useMemo(() => inScope(data.classesUpcoming), [data, branch]) // eslint-disable-line react-hooks/exhaustive-deps
  const ending = useMemo(() => inScope(data.classesEndingThisMonth), [data, branch]) // eslint-disable-line react-hooks/exhaustive-deps
  const atRisk = upcoming.filter((c) => c.minStudents != null && c.students < c.minStudents)
  const riskStudents = useMemo(() => inScope(data.atRiskStudents), [data, branch]) // eslint-disable-line react-hooks/exhaustive-deps
  const forward = useMemo(() => inScope(data.forwardRevenue).reduce(
    (a, r) => ({ classes: a.classes + r.classes, enrollments: a.enrollments + r.enrollments, sales: a.sales + Number(r.sales), collected: a.collected + Number(r.collected) }),
    { classes: 0, enrollments: 0, sales: 0, collected: 0 },
  ), [data, branch]) // eslint-disable-line react-hooks/exhaustive-deps
  const endingLeft = ending.filter((c) => c.endDate >= today)

  // รายเดือน: เปิดใหม่ + อัตราเต็มห้อง + อัตราเรียนต่อ (ข้อมูลย้อนหลัง 12 เดือนก่อนช่วงไว้เทียบปีก่อน)
  const monthly = useMemo(() => {
    const opened = new Map<string, { opened: number; students: number; seats: number; revenue: number }>()
    for (const r of inScope(data.classesMonthly)) {
      const x = opened.get(r.month) ?? { opened: 0, students: 0, seats: 0, revenue: 0 }
      x.opened += r.opened; x.students += r.students; x.seats += r.seats; x.revenue += Number(r.revenue)
      opened.set(r.month, x)
    }
    const cont = new Map<string, { finished: number; continued: number }>()
    for (const r of inScope(data.continuation)) {
      const x = cont.get(r.month) ?? { finished: 0, continued: 0 }
      x.finished += r.finished; x.continued += r.continued
      cont.set(r.month, x)
    }
    const get = (m: string) => opened.get(m) ?? { opened: 0, students: 0, seats: 0, revenue: 0 }
    return months.map((m) => {
      const o = get(m)
      const c = cont.get(m) ?? { finished: 0, continued: 0 }
      return {
        month: m,
        label: thaiMonthLabel(m) + (m === today.slice(0, 7) ? '*' : ''),
        ...o,
        prevOpened: get(addMonthsYm(m, -1)).opened,
        lastYearOpened: get(addMonthsYm(m, -12)).opened,
        fillRate: percent(o.students, o.seats),
        revenuePerClass: o.opened ? Math.round(o.revenue / o.opened) : null,
        studentsPerClass: o.opened ? Math.round((o.students / o.opened) * 10) / 10 : null,
        finished: c.finished,
        continued: c.continued,
        continuationRate: percent(c.continued, c.finished),
      }
    })
  }, [data, branch, months, today]) // eslint-disable-line react-hooks/exhaustive-deps

  // เทียบเดือนล่าสุดที่จบแล้ว (เดือนนี้ยังไม่จบ ตัวเลขยังขึ้นได้)
  const lastFull = addMonthsYm(today.slice(0, 7), -1)
  const lf = monthly.find((r) => r.month === lastFull)
  const vsPrev = lf ? change(lf.opened, lf.prevOpened) : null
  const vsYear = lf ? change(lf.opened, lf.lastYearOpened) : null

  const rowLink = (id: string) => () => router.push(`/classes/${id}`)

  return (
    <div className="space-y-6 min-w-0">
      <h2 className="text-xl font-semibold text-gray-900 pt-2">คลาสเรียน</h2>

      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
        <KpiCard icon={School} gradient="blue" label="กำลังเรียนอยู่" value={`${active.classes} คลาส`}
          sub={`${active.students} คน · เต็ม ${percentText(active.students, active.seats)}`} />
        <KpiCard icon={CalendarClock} gradient={upcoming.length <= 2 ? 'rose' : 'violet'} label="กำลังจะเริ่ม (60 วัน)" value={`${upcoming.length} คลาส`}
          sub={atRisk.length ? `ยังไม่ถึงขั้นต่ำ ${atRisk.length} คลาส` : 'ถึงขั้นต่ำทุกคลาส'} />
        <KpiCard icon={CalendarX2} gradient="amber" label={`จบใน${thaiMonthLabel(today.slice(0, 7)).split(' ')[0]}`} value={`${ending.length} คลาส`}
          sub={`จบแล้ว ${ending.length - endingLeft.length} · เหลือ ${endingLeft.length}`} />
        <KpiCard icon={TrendingUp} gradient="emerald" label={`เปิดใหม่ ${thaiMonthLabel(lastFull)}`} value={`${lf?.opened ?? 0} คลาส`}
          sub={vsPrev && vsYear ? `เดือนก่อน ${vsPrev.text} · ปีก่อน ${vsYear.text}` : '—'} />
        <KpiCard icon={PiggyBank} gradient="cyan" label="รายได้ล่วงหน้า" value={formatBaht(forward.sales)}
          sub={`${forward.enrollments} คน · ${forward.classes} คลาสที่ยังไม่เริ่ม`} />
        <KpiCard icon={UserX} gradient={riskStudents.length ? 'rose' : 'emerald'} label="เด็กเสี่ยงเลิกเรียน" value={`${riskStudents.length} คน`}
          sub={`ขาดติดกัน 3 ครั้งขึ้นไป ${riskStudents.filter((r) => r.streak >= 3).length} คน`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="คลาสเปิดใหม่รายเดือน" description="นับตามวันเริ่มคลาส (ไม่รวมคลาสที่ยกเลิก) · เส้น = อัตราเต็มห้อง (นักเรียน ÷ ที่นั่ง) · * = เดือนที่ยังไม่จบ">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="label" tick={chartAxisTick} />
              <YAxis yAxisId="n" tick={chartAxisTick} width={36} allowDecimals={false} />
              <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={chartAxisTick} width={44} />
              <ChartTooltip formatter={(v: number, name: string) => (name === 'เต็มห้อง' ? `${v}%` : `${v} คลาส`)} />
              <Legend wrapperStyle={chartLegendStyle} />
              <Bar yAxisId="n" dataKey="lastYearOpened" name="ปีก่อน" fill={CHART_COLORS.muted} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="n" dataKey="opened" name="เปิดใหม่" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} />
              <Line yAxisId="p" type="linear" dataKey="fillRate" name="เต็มห้อง" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="อัตราเรียนต่อ" description="เด็กที่เรียนจบคลาสในเดือนนั้น แล้วลงคลาสถัดไป (เริ่มภายใน 30 วันก่อน – 60 วันหลังวันจบ) · เดือนล่าสุดจะค่อย ๆ ขึ้น">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="label" tick={chartAxisTick} />
              <YAxis yAxisId="n" tick={chartAxisTick} width={36} allowDecimals={false} />
              <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={chartAxisTick} width={44} />
              <ChartTooltip formatter={(v: number, name: string) => (name === 'เรียนต่อ %' ? `${v}%` : `${v} คน`)} />
              <Legend wrapperStyle={chartLegendStyle} />
              <Bar yAxisId="n" dataKey="finished" name="เรียนจบ" fill={CHART_COLORS.indigoSoft} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="n" dataKey="continued" name="ลงต่อ" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
              <Line yAxisId="p" type="linear" dataKey="continuationRate" name="เรียนต่อ %" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="ยอดขายต่อคลาส" description="ยอดลงทะเบียนรวม ÷ จำนวนคลาสที่เปิดในเดือนนั้น (ตามวันเริ่มคลาส) · เส้น = นักเรียนเฉลี่ยต่อคลาส">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="label" tick={chartAxisTick} />
              <YAxis yAxisId="b" tickFormatter={formatCompact} tick={chartAxisTick} width={48} />
              <YAxis yAxisId="n" orientation="right" tick={chartAxisTick} width={36} allowDecimals={false} />
              <ChartTooltip formatter={(v: number, name: string) => (name === 'นักเรียน/คลาส' ? `${v} คน` : formatBaht(v))} />
              <Legend wrapperStyle={chartLegendStyle} />
              <Bar yAxisId="b" dataKey="revenuePerClass" name="ยอดขาย/คลาส" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} />
              <Line yAxisId="n" type="linear" dataKey="studentsPerClass" name="นักเรียน/คลาส" stroke={CHART_COLORS.amber} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="เด็กเสี่ยงเลิกเรียน"
          description="ไม่ได้มาเรียนติดกันตั้งแต่ 2 ครั้งล่าสุดที่เช็คชื่อ (คลาสที่กำลังเรียน) · คลิกแถวเพื่อเปิดหน้าคลาส"
          action={<Button asChild variant="outline"><Link href="/followups#at_risk">บันทึกการโทร</Link></Button>}
          contentClassName="overflow-x-auto max-h-[420px] overflow-y-auto"
        >
          {riskStudents.length === 0 ? (
            <EmptyState icon={UserX} title="ไม่มีเด็กที่ขาดติดกัน" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">นักเรียน</TableHead>
                  <TableHead className="min-w-[160px]">คลาส</TableHead>
                  {isAll && <TableHead>สาขา</TableHead>}
                  <TableHead className="text-right whitespace-nowrap">ขาดติดกัน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskStudents.map((r) => (
                  <TableRow key={r.enrollmentId} className="cursor-pointer hover:bg-gray-50" onClick={rowLink(r.classId)}>
                    <TableCell>
                      <div className="font-medium">{r.studentNickname || r.studentName}</div>
                      <div className="text-gray-500">
                        {r.parentName || '—'}
                        {r.parentPhone && (
                          <> · <a href={`tel:${r.parentPhone}`} onClick={(e) => e.stopPropagation()} className="num text-blue-600 hover:underline">{r.parentPhone}</a></>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{r.subject}</div>
                      <div className="text-gray-500">
                        มาล่าสุด {r.lastPresent ? thaiDateLabel(r.lastPresent) : 'ยังไม่เคยมา'}{r.teacher && ` · ครู${r.teacher}`}
                      </div>
                    </TableCell>
                    {isAll && <TableCell className="whitespace-nowrap">{branchName(r.branchId)}</TableCell>}
                    <TableCell className="num text-right whitespace-nowrap">
                      <Pill tone={r.streak >= 3 ? 'red' : 'amber'}>{r.streak} ครั้ง</Pill>
                      <div className="text-gray-500 mt-1">ขาด {r.absent}{r.excused > 0 && ` · ลา/ป่วย ${r.excused}`}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard
          title="กำลังจะเริ่ม (60 วันข้างหน้า)"
          description="คลิกแถวเพื่อเปิดหน้าคลาส · ป้ายแดง = นักเรียนยังไม่ถึงจำนวนขั้นต่ำ"
          contentClassName="overflow-x-auto"
        >
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="ยังไม่มีคลาสที่จะเริ่มใน 60 วัน" description="ถ้าคลาสที่จบเดือนนี้ไม่มีรุ่นต่อ เด็กอาจไม่มีคลาสให้ลงต่อ" />
          ) : (
            <ClassTable rows={upcoming} dateKey="startDate" dateLabel="เริ่ม" today={today} isAll={isAll} branchName={branchName} onRow={rowLink} />
          )}
        </ChartCard>

        <ChartCard
          title={`จบใน${thaiMonthLabel(today.slice(0, 7)).split(' ')[0]}`}
          description="ใช้วางแผนเปิดรุ่นต่อให้เด็กลงเรียนต่อ · คลิกแถวเพื่อเปิดหน้าคลาส"
          contentClassName="overflow-x-auto max-h-[480px] overflow-y-auto"
        >
          {ending.length === 0 ? (
            <EmptyState icon={Repeat} title="ไม่มีคลาสที่จบเดือนนี้" />
          ) : (
            <ClassTable rows={ending} dateKey="endDate" dateLabel="จบ" today={today} isAll={isAll} branchName={branchName} onRow={rowLink} />
          )}
        </ChartCard>
      </div>
    </div>
  )
}

function ClassTable({ rows, dateKey, dateLabel, today, isAll, branchName, onRow }: {
  rows: ClassItem[]
  dateKey: 'startDate' | 'endDate'
  dateLabel: string
  today: string
  isAll: boolean
  branchName: (id: string) => string
  onRow: (id: string) => () => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="whitespace-nowrap">{dateLabel}</TableHead>
          <TableHead className="min-w-[180px]">คลาส</TableHead>
          {isAll && <TableHead>สาขา</TableHead>}
          <TableHead className="text-right">นักเรียน</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => {
          const d = c[dateKey]
          const diff = daysBetween(today, d)
          const below = c.minStudents != null && c.students < c.minStudents
          return (
            <TableRow key={c.id} className="cursor-pointer hover:bg-gray-50" onClick={onRow(c.id)}>
              <TableCell className="num whitespace-nowrap">
                <div>{thaiDateLabel(d)}</div>
                <div className="text-gray-500">{diff < 0 ? `${-diff} วันก่อน` : diff === 0 ? 'วันนี้' : `อีก ${diff} วัน`}</div>
              </TableCell>
              <TableCell>
                <div>{c.subject}</div>
                <div className="text-gray-500">
                  {daysText(c.daysOfWeek)} {c.startTime && `${c.startTime}–${c.endTime}`}{c.teacher && ` · ครู${c.teacher}`}
                </div>
                {c.status === 'draft' && <Pill tone="gray" className="mt-1">ร่าง</Pill>}
              </TableCell>
              {isAll && <TableCell className="whitespace-nowrap">{branchName(c.branchId)}</TableCell>}
              <TableCell className="num text-right whitespace-nowrap">
                <div>{c.students}/{c.maxStudents ?? '?'}</div>
                {below && <Pill tone="red" className="mt-1">ขั้นต่ำ {c.minStudents}</Pill>}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
