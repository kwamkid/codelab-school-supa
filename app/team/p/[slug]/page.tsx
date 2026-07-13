'use client'

// Public practice page. Works in the LINE in-app browser (LIFF) AND in an
// external browser (LINE web-login). Auth/fetch handled by useTeamAuth.

import { useParams } from 'next/navigation'
import { LiffProvider } from '@/components/liff/liff-provider'
import { Loading } from '@/components/ui/loading'
import { LineGate } from '../../line-gate'
import { useTeamAuth } from '../../use-team-auth'
import { ProposePractice } from './propose-practice'

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

  if (loading) return <Loading fullScreen size="lg" />
  if (gate) return <LineGate message={gate} />
  if (!data) return <LineGate message="เกิดข้อผิดพลาด" />

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary text-white p-4 pt-6">
        <h1 className="text-xl font-bold">เสนอวันซ้อม</h1>
        <p className="text-white/90 text-sm mt-1">
          ทีม {data.team.team_number}
          {data.team.name ? ` — ${data.team.name}` : ''}
        </p>
        {data.parentDisplayName && (
          <p className="text-white/80 text-xs mt-1">ผู้ปกครอง: {data.parentDisplayName}</p>
        )}
      </div>
      <div className="p-4">
        {data.kids.length === 0 ? (
          <p className="text-center text-gray-500 py-8">ทีมนี้ยังไม่มีเด็ก</p>
        ) : (
          <ProposePractice kids={data.kids} initialPractices={data.practices} onSubmit={submit} />
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
