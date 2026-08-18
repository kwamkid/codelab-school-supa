// app/api/admin/line/friendship-scan/route.ts
// POST → สแกนสถานะ "แอด LINE OA แล้วหรือยัง" ของผู้ปกครองทุกคนที่ผูก LINE ไว้
// แล้วเก็บผลลง parents.line_friend_state (ใช้โดยปุ่มในหน้ารายชื่อผู้ปกครอง)
//
// ใช้เวลาราว 20-40 วิ สำหรับ ~200 คน (ยิง LINE ทีละ 8)

import { NextResponse } from 'next/server'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { scanParentFriendship } from '@/lib/supabase/services/line-friendship-scan'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const staff = await requireStaff(bearer(request.headers.get('authorization')))
  if (!staff.ok) return NextResponse.json({ error: staff.error }, { status: staff.status ?? 401 })

  const result = await scanParentFriendship()
  return NextResponse.json({ success: true, ...result })
}
