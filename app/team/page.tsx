'use client'

// Endpoint root of the "Team" LIFF app (endpoint URL = /team). Opening a
// https://liff.line.me/<VEX_LIFF_ID>/p/<slug> link lands here with
// ?liff.state=/p/<slug>; liff.init() consumes that and redirects to
// /team/p/<slug> automatically. A direct visit (no liff.state) just shows a
// hint — there is nothing at the bare /team path.

import { LiffProvider } from '@/components/liff/liff-provider'
import { Users } from 'lucide-react'

function TeamRootContent() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="text-center space-y-3 max-w-sm">
        <Users className="h-12 w-12 text-gray-300 mx-auto" />
        <h1 className="text-lg font-semibold">CodeLab VEX Team</h1>
        <p className="text-sm text-gray-500">
          กรุณาเปิดผ่านลิงก์ทีมที่ได้รับจากโค้ช (ตารางการแข่งขัน หรือ ตารางเข้าซ้อม)
        </p>
      </div>
    </div>
  )
}

export default function TeamRootPage() {
  return (
    <LiffProvider requireLogin={false} liffId={process.env.NEXT_PUBLIC_VEX_LIFF_ID}>
      <TeamRootContent />
    </LiffProvider>
  )
}
