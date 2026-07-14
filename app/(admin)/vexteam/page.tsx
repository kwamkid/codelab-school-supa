'use client'

// VEX Team → Teams. (Events and practice requests are sibling pages, reached via
// the sidebar submenu.)

import { PageHeader } from '@/components/ui/page-header'
import { Trophy } from 'lucide-react'
import { TeamsTab } from './teams-tab'

export default function VexTeamsPage() {
  return (
    <div className="p-4 sm:p-6 text-base">
      <PageHeader title="ทีม VEX" icon={Trophy} iconColor="text-red-600" description="จัดการทีม VEX และเด็กในทีม" />
      <TeamsTab />
    </div>
  )
}
