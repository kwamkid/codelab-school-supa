'use client'

// Public event-RSVP page. Works in the LINE in-app browser (LIFF) AND in an
// external browser (LINE web-login). Auth/fetch handled by useTeamAuth. Blocks
// with <LineGate> when the LINE user isn't a registered codelab parent (403).

import { useParams } from 'next/navigation'
import { LiffProvider } from '@/components/liff/liff-provider'
import { Loading } from '@/components/ui/loading'
import { LineGate } from '../../line-gate'
import { TeamHeader } from '../../team-header'
import { useTeamAuth } from '../../use-team-auth'
import { EventRsvp } from './event-rsvp'
import type { RsvpStatus } from '@/lib/vex/types'

interface SummaryData {
  team: { id: string; team_number: string; name: string | null; level: string }
  kids: { id: string; nickname: string }[]
  parentDisplayName: string | null
  events: any[]
  attendance: any[]
}

function EventRsvpInner({ slug }: { slug: string }) {
  const { data, loading, gate, lineUserId, call } = useTeamAuth<SummaryData>(slug, 'event')

  const save = async (eventId: string, kidId: string, status: RsvpStatus) => {
    await call(`/api/liff/vex/${slug}/attendance`, { event_id: eventId, kid_id: kidId, status })
  }

  if (loading) return <Loading fullScreen size="lg" />
  if (gate) return <LineGate message={gate} />
  if (!data) return <LineGate message="เกิดข้อผิดพลาด" />

  return (
    <div className="min-h-screen bg-gray-50">
      <TeamHeader
        title="ตารางการแข่งขัน"
        teamLabel={`ทีม ${data.team.team_number}${data.team.name ? ` — ${data.team.name}` : ''}`}
        parentName={data.parentDisplayName}
      />
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {data.kids.length === 0 ? (
          <p className="text-center text-gray-500 py-8">ทีมนี้ยังไม่มีเด็ก</p>
        ) : (
          <EventRsvp
            slug={slug}
            kids={data.kids}
            events={data.events}
            initialAttendance={data.attendance}
            lineUserId={lineUserId}
            onSave={save}
          />
        )}
      </div>
    </div>
  )
}

export default function EventRsvpPage() {
  const params = useParams()
  const slug = params.slug as string
  return (
    <LiffProvider requireLogin={false} liffId={process.env.NEXT_PUBLIC_VEX_LIFF_ID}>
      <EventRsvpInner slug={slug} />
    </LiffProvider>
  )
}
