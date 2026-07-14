'use client'

// Public practice page. Works in the LINE in-app browser (LIFF) AND in an
// external browser (LINE web-login). Auth/fetch handled by useTeamAuth.

import { useParams } from 'next/navigation'
import { LiffProvider } from '@/components/liff/liff-provider'
import { Loading } from '@/components/ui/loading'
import { LineGate } from '../../line-gate'
import { TeamHeader } from '../../team-header'
import { useTeamAuth } from '../../use-team-auth'
import { PracticeCalendar } from './practice-calendar'

interface SummaryData {
  team: { id: string; team_number: string; name: string | null; level: string }
  kids: { id: string; nickname: string }[]
  parentDisplayName: string | null
  practices: any[]
}

function ProposePracticeInner({ slug }: { slug: string }) {
  const { data, loading, gate, call } = useTeamAuth<SummaryData>(slug, 'practice')

  const submit = async (body: {
    kid_id: string
    practice_date: string
    start_time?: string
    end_time?: string
    note?: string
  }) => {
    const res = await call<{ practice: any }>(`/api/liff/vex/${slug}/practices`, body)
    return res.practice
  }

  const editPractice = async (
    id: string,
    body: { start_time?: string; end_time?: string; note?: string | null; practice_date?: string }
  ) => {
    const res = await call<{ practice: any }>(`/api/liff/vex/${slug}/practices/${id}`, body, 'PATCH')
    return res.practice
  }

  const deletePractice = async (id: string) => {
    await call(`/api/liff/vex/${slug}/practices/${id}`, {}, 'DELETE')
  }

  if (loading) return <Loading fullScreen size="lg" />
  if (gate) return <LineGate message={gate} />
  if (!data) return <LineGate message="เกิดข้อผิดพลาด" />

  return (
    <div className="min-h-screen bg-gray-50">
      <TeamHeader
        title="ตารางวันซ้อม"
        teamLabel={`ทีม ${data.team.team_number}${data.team.name ? ` — ${data.team.name}` : ''}`}
        parentName={data.parentDisplayName}
      />
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {data.kids.length === 0 ? (
          <p className="text-center text-gray-500 py-8">ทีมนี้ยังไม่มีเด็ก</p>
        ) : (
          <PracticeCalendar
            kids={data.kids}
            initialPractices={data.practices}
            onSubmit={submit}
            onEdit={editPractice}
            onDelete={deletePractice}
          />
        )}
      </div>
    </div>
  )
}

export default function ProposePracticePage() {
  const params = useParams()
  const slug = params.slug as string
  return (
    <LiffProvider requireLogin={false}>
      <ProposePracticeInner slug={slug} />
    </LiffProvider>
  )
}
