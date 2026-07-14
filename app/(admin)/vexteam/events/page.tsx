'use client'

// VEX Team → Events (competition schedule).

import { PageHeader } from '@/components/ui/page-header'
import { CalendarDays } from 'lucide-react'
import { EventsTab } from '../events-tab'

export default function VexEventsPage() {
  return (
    <div className="p-4 sm:p-6 text-base">
      <PageHeader
        title="กิจกรรมการแข่งขัน"
        icon={CalendarDays}
        iconColor="text-red-600"
        description="กิจกรรมการแข่งขัน VEX และระดับที่เข้าร่วมได้"
      />
      <EventsTab />
    </div>
  )
}
