import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getFacebookAdsSettings } from '@/lib/supabase/services/facebook-ads-settings'
import { removeFromCustomAudience } from '@/lib/fb/api'
import { hashPhone, hashEmail } from '@/lib/fb/utils'

export const dynamic = 'force-dynamic'

/**
 * Called when enrollment status changes to completed/dropped.
 * Checks if parent has remaining active enrollments.
 * If not → remove from "ลูกค้าปัจจุบัน" audience.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { enrollmentId, newStatus } = body as {
      enrollmentId: string
      newStatus: string
    }

    if (!enrollmentId || !newStatus) {
      return NextResponse.json(
        { success: false, error: 'Missing enrollmentId or newStatus' },
        { status: 400 }
      )
    }

    // Only handle completed/dropped
    if (newStatus !== 'completed' && newStatus !== 'dropped') {
      return NextResponse.json({ success: true, skipped: true })
    }

    const settings = await getFacebookAdsSettings()

    if (!settings.fbAccessToken || !settings.audienceCurrentStudents) {
      return NextResponse.json({ success: true, skipped: true })
    }

    const supabase = createServiceClient()

    // Get parent_id from the enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('parent_id')
      .eq('id', enrollmentId)
      .single()

    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      )
    }

    const parentId = (enrollment as { parent_id: string }).parent_id

    // Check if parent has any remaining active enrollments
    const { count } = await supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parentId)
      .eq('status', 'active')

    if ((count ?? 0) > 0) {
      // Parent still has active enrollments — don't remove
      return NextResponse.json({ success: true, skipped: true, reason: 'has_active_enrollments' })
    }

    // No active enrollments left → remove from ลูกค้าปัจจุบัน
    const { data: parent } = await supabase
      .from('parents')
      .select('phone, email')
      .eq('id', parentId)
      .single()

    if (!parent) {
      return NextResponse.json({ success: true, skipped: true, reason: 'parent_not_found' })
    }

    const { phone, email } = parent as { phone: string; email: string | null }

    if (!phone) {
      return NextResponse.json({ success: true, skipped: true, reason: 'no_phone' })
    }

    const phoneHash = hashPhone(phone)
    const emailHash = email ? hashEmail(email) : undefined

    const result = await removeFromCustomAudience(
      settings.fbAccessToken,
      settings.audienceCurrentStudents,
      phoneHash,
      emailHash
    )

    console.log(
      '[FB] enrollment-status-change: removed from current_students',
      result.success ? 'OK' : 'FAIL',
      result.error || ''
    )

    return NextResponse.json({
      success: result.success,
      action: 'removed_from_current_students',
      parentId,
    })
  } catch (error) {
    console.error('[FB] enrollment-status-change error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    )
  }
}
