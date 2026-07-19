'use client'

// Who confirmed for a competition: per-team kid lists with RSVP status
// (ไป / ไม่ไป / ยังไม่ตอบ) + summary counts. Opened from the events tab.

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { LevelBadge } from '@/components/vex/level-badge'
import { SectionLoading } from '@/components/ui/loading'
import { cn } from '@/lib/utils'
import { Check, HelpCircle, X } from 'lucide-react'

interface RsvpKid { id: string; nickname: string; status: 'go' | 'no' | 'pend'; updatedAt: string | null }
interface RsvpTeam {
  teamId: string; teamNumber: string; teamName: string | null; level: string
  branchId: string | null; kids: RsvpKid[]; goCount: number
}

const STATUS_STYLE: Record<RsvpKid['status'], { chip: string; label: string; icon: any }> = {
  go: { chip: 'bg-green-50 text-green-700', label: 'ไป', icon: Check },
  no: { chip: 'bg-red-50 text-red-600', label: 'ไม่ไป', icon: X },
  pend: { chip: 'bg-gray-100 text-gray-500', label: 'ยังไม่ตอบ', icon: HelpCircle },
}

export function EventRsvpsDialog({
  eventId,
  eventName,
  branchId,
  open,
  onOpenChange,
}: {
  eventId: string
  eventName: string
  /** Scope to the top-bar branch when set (events are level-wide). */
  branchId?: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [teams, setTeams] = useState<RsvpTeam[]>([])
  const [counts, setCounts] = useState({ go: 0, no: 0, pend: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        setLoading(true)
        const res = await authFetch(`/api/admin/vex/events/${eventId}/rsvps`)
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || 'โหลดรายชื่อไม่สำเร็จ')
          return
        }
        const list: RsvpTeam[] = (data.teams || []).filter(
          (t: RsvpTeam) => !branchId || t.branchId === branchId
        )
        setTeams(list)
        // Recompute counts over the branch-scoped list so numbers match rows.
        const c = { go: 0, no: 0, pend: 0 }
        list.forEach((t) => t.kids.forEach((k) => c[k.status]++))
        setCounts(c)
      } catch {
        toast.error('เกิดข้อผิดพลาด')
      } finally {
        setLoading(false)
      }
    })()
  }, [open, eventId, branchId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>รายชื่อยืนยันเข้าแข่งขัน</DialogTitle>
          <DialogDescription>{eventName}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <SectionLoading />
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-2 text-base">
              <Badge className="bg-green-100 text-green-700">ไป {counts.go}</Badge>
              <Badge className="bg-red-100 text-red-600">ไม่ไป {counts.no}</Badge>
              <Badge className="bg-gray-100 text-gray-500">ยังไม่ตอบ {counts.pend}</Badge>
            </div>

            {teams.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">ไม่มีทีมในระดับของงานนี้</p>
            )}

            {teams.map((t) => (
              <div key={t.teamId} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <LevelBadge level={t.level as any} logoHeight={18} className="border-0 bg-transparent px-0 py-0" />
                  <span className="font-semibold">{t.teamNumber}</span>
                  {t.teamName && <span className="text-gray-500 text-sm truncate">— {t.teamName}</span>}
                  <span className="ml-auto text-sm text-green-700 font-medium shrink-0">
                    ไป {t.goCount}/{t.kids.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.kids.map((k) => {
                    const s = STATUS_STYLE[k.status]
                    const Icon = s.icon
                    return (
                      <span
                        key={k.id}
                        className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium', s.chip)}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {k.nickname}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
