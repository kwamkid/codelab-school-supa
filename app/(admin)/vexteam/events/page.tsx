'use client'

// VEX Team → Events (competition schedule).

import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { CalendarDays, ClipboardList } from 'lucide-react'
import { EventsTab } from '../events-tab'

export default function VexEventsPage() {
  return (
    <div className="p-4 sm:p-6 text-base">
      <PageHeader
        title="กิจกรรมการแข่งขัน"
        icon={CalendarDays}
        iconColor="text-red-600"
        description="กิจกรรมการแข่งขัน VEX และระดับที่เข้าร่วมได้"
        action={
          <Button variant="outline" asChild>
            <Link href="/vexteam/events/roster">
              <ClipboardList className="h-4 w-4 mr-1" /> รายชื่อเข้าแข่งขัน
            </Link>
          </Button>
        }
      />
      <EventsTab />
    </div>
  )
}
