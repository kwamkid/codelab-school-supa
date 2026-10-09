import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveLiffUser } from '@/lib/line/verify-liff-token'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = createServiceClient()

  try {
    const { searchParams } = new URL(request.url)
    // Returns parent name/phone/email → only for a VERIFIED LIFF ID token
    // (Authorization: Bearer <liff.getIDToken()>). The ?lineUserId= param alone
    // is no longer trusted (no in-app callers as of Oct 2026).
    const who = await resolveLiffUser(request, { lineUserId: searchParams.get('lineUserId') })
    if (!who?.verified) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const lineUserId = who.lineUserId

    // Get user's registrations
    const { data: registrations, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('line_user_id', lineUserId)
      .order('schedule_date', { ascending: false })

    if (error) throw error

    // Transform data to match expected format
    const transformedRegistrations = (registrations || []).map((reg: any) => ({
      id: reg.id,
      eventId: reg.event_id,
      scheduleId: reg.schedule_id,
      branchId: reg.branch_id,
      lineUserId: reg.line_user_id,
      parentName: reg.parent_name,
      parentPhone: reg.parent_phone,
      parentEmail: reg.parent_email,
      scheduleDate: reg.schedule_date,
      registeredAt: reg.registered_at || reg.created_at,
      cancelledAt: reg.cancelled_at,
      attendanceCheckedAt: reg.attendance_checked_at,
      status: reg.status,
      attendeeCount: reg.attendee_count,
      isGuest: reg.is_guest,
      students: reg.students || []
    }))

    return NextResponse.json({ registrations: transformedRegistrations })
  } catch (error: any) {
    console.error('[API] Error getting user registrations:', error)
    return NextResponse.json({ error: 'Failed to get registrations' }, { status: 500 })
  }
}