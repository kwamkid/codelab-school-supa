'use client'

// สรุป "ติดตามลูกค้า" ในรายงานผู้บริหาร — ยังไม่ติดต่อกี่คน ของแต่ละงาน (ทดลองแล้วหาย / เสี่ยงเลิก / จะจบคอร์ส)
// ให้ CEO ตามทีมได้ · กดการ์ดไปหน้า /followups#<kind> · ใช้ API เดียวกับหน้า /followups (ค่าเริ่มต้นของหน้า)

import Link from 'next/link'
import { CalendarX2, TestTube, UserX } from 'lucide-react'
import { useAdminJson } from '@/hooks/useAdminJson'
import { cn } from '@/lib/utils'

type Kind = 'trial' | 'at_risk' | 'ending'
interface Row { followup: { status: string } | null; renewedTo?: unknown }
interface Data { trial: Row[]; atRisk: Row[]; ending: Row[] }

const META: Record<Kind, { label: string; icon: typeof TestTube; window: string }> = {
  trial: { label: 'ทดลองเรียนแล้วหายไป', icon: TestTube, window: 'ทดลองใน 120 วัน' },
  at_risk: { label: 'เด็กเสี่ยงเลิกเรียน', icon: UserX, window: 'ขาดติดกัน 2 ครั้งขึ้นไป' },
  ending: { label: 'จะจบคอร์ส', icon: CalendarX2, window: 'จบใน 30 วัน' },
}

function tally(rows: Row[]) {
  let pending = 0, contacted = 0, noAnswer = 0, renewed = 0
  for (const r of rows) {
    if (r.renewedTo) renewed++
    else if (!r.followup) pending++
    else if (r.followup.status === 'contacted') contacted++
    else noAnswer++
  }
  return { total: rows.length, pending, contacted, noAnswer, renewed }
}

export function ExecutiveFollowups({ branch }: { branch: string }) {
  const qs = branch === 'all' ? '' : `?branchId=${branch}`
  const { data } = useAdminJson<Data>(`/api/admin/followups${qs}`, 'โหลดงานติดตามลูกค้าไม่สำเร็จ')
  if (!data) return null

  const lists: Record<Kind, Row[]> = { trial: data.trial, at_risk: data.atRisk, ending: data.ending }

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-gray-900">งานติดตามลูกค้า</h2>
        <Link href="/followups" className="text-blue-600 hover:underline">เปิดหน้าติดตามลูกค้า</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['trial', 'at_risk', 'ending'] as Kind[]).map((k) => {
          const t = tally(lists[k])
          const Icon = META[k].icon
          return (
            <Link key={k} href={`/followups#${k}`} className="rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50 min-w-0">
              <div className="flex items-center gap-2 font-medium">
                <Icon className="h-5 w-5 text-rose-500 shrink-0" />
                <span className="truncate">{META[k].label}</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={cn('num text-3xl font-bold', t.pending ? 'text-red-600' : 'text-emerald-600')}>{t.pending}</span>
                <span className="text-gray-600">ยังไม่ติดต่อ</span>
              </div>
              <div className="num text-gray-500 mt-1">
                ทั้งหมด {t.total} · ติดต่อแล้ว {t.contacted} · ติดต่อไม่ได้ {t.noAnswer}{k === 'ending' && ` · ลงต่อแล้ว ${t.renewed}`}
              </div>
              <div className="text-gray-400 mt-0.5">{META[k].window}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
