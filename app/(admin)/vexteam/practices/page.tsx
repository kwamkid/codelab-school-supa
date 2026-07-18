'use client'

// VEX Team → Practice requests (admin review).

import { useEffect, useState, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { PageHeader } from '@/components/ui/page-header'
import { CalendarClock } from 'lucide-react'
import { useBranch } from '@/contexts/BranchContext'
import { PracticesReview } from '../practices-review'
import { AddPracticeDialog } from '../add-practice-dialog'

export default function VexPracticesPage() {
  const { selectedBranchId } = useBranch()
  const [teams, setTeams] = useState<{ id: string; team_number: string; name: string | null; branch_id: string | null }[]>([])

  const loadTeams = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/vex/teams')
      const data = await res.json()
      if (res.ok) {
        setTeams(
          (data.teams || []).map((t: any) => ({ id: t.id, team_number: t.team_number, name: t.name, branch_id: t.branch_id }))
        )
      }
    } catch {
      // non-fatal — the team filter just won't show
    }
  }, [])

  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  return (
    <div className="p-4 sm:p-6 text-base">
      <PageHeader
        title="คำขอซ้อม"
        icon={CalendarClock}
        iconColor="text-red-600"
        description="อนุมัติ / ปฏิเสธ / ปรับเวลา คำขอเข้าซ้อมจากผู้ปกครอง"
        action={
          <AddPracticeDialog
            branchId={selectedBranchId}
            // PracticesReview listens for this event and reloads its list
            onCreated={() => window.dispatchEvent(new Event('vex-practices-changed'))}
          />
        }
      />
      <PracticesReview teams={teams} />
    </div>
  )
}
