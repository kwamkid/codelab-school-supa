'use client'

// Dashboard birthday alert: kids whose birthday (next 14 days) falls within
// ±2 days of one of their own class sessions — i.e. they'll be AT CodeLab
// around their birthday, so staff can prepare a wish. Data from the
// get_upcoming_birthdays RPC (one round-trip, Bangkok dates). Renders nothing
// when no birthdays match.

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { useBranch } from '@/contexts/BranchContext'
import { Card, CardContent } from '@/components/ui/card'
import { StudentBadge } from '@/components/ui/student-badge'
import { Cake } from 'lucide-react'

interface BirthdayEntry {
  studentName: string
  fullName: string
  birthday: string // yyyy-mm-dd
  turning: number
  sessions: {
    subjectName: string
    subjectColor: string | null
    sessionDate: string
    startTime: string
    endTime: string
    branchName: string | null
  }[]
}

const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function thaiShort(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return `${THAI_DAYS[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`
}

export default function BirthdayCard() {
  const { selectedBranchId } = useBranch()
  const [entries, setEntries] = useState<BirthdayEntry[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const supabase = getClient() as any
        const { data, error } = await supabase.rpc('get_upcoming_birthdays', {
          p_branch_id: selectedBranchId || null,
          p_days: 14,
        })
        if (!error && active) setEntries(data || [])
      } catch (e) {
        console.error('[birthday-card] load error:', e)
      }
    })()
    return () => { active = false }
  }, [selectedBranchId])

  if (entries.length === 0) return null

  return (
    <Card className="py-0 border-pink-200 bg-pink-50/50">
      <CardContent className="p-4">
        <h3 className="font-semibold text-base flex items-center gap-2 mb-3">
          <span className="p-1.5 rounded-lg bg-pink-500 text-white"><Cake className="h-4 w-4" /></span>
          วันเกิดนักเรียนเร็วๆ นี้
          <span className="text-sm font-normal text-gray-500">(มีเรียนช่วงวันเกิด ±2 วัน)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {entries.map((e, i) => (
            <div key={`${e.fullName}-${i}`} className="rounded-lg bg-white border border-pink-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <StudentBadge name={e.studentName} size="md" />
                <span className="text-sm text-gray-600 shrink-0">
                  🎂 {thaiShort(e.birthday)} · ครบ <span className="font-bold text-pink-600">{e.turning}</span> ปี
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {e.sessions.map((s, j) => (
                  <div key={j} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.subjectColor || '#94A3B8' }} />
                    <span className="truncate">{s.subjectName}</span>
                    <span className="shrink-0 text-gray-500">
                      {thaiShort(s.sessionDate)} {s.startTime?.slice(0, 5)}
                      {s.sessionDate === e.birthday && <span className="ml-1 text-pink-600 font-medium">ตรงวันเกิด!</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
