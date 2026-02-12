import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendFBConversionInternal, ConversionParams } from '@/lib/fb/handler'
import { hashPhone, hashEmail } from '@/lib/fb/utils'
import {
  getFacebookAdsSettings,
} from '@/lib/supabase/services/facebook-ads-settings'
import { addToCustomAudience, removeFromCustomAudience } from '@/lib/fb/api'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { member_id, new_phone, new_email, old_phone, old_email } = body

    if (!member_id || !new_phone) {
      return NextResponse.json(
        { success: false, error: 'Missing member_id or new_phone' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const settings = await getFacebookAdsSettings()

    if (!settings.fbPixelId || !settings.fbAccessToken) {
      return NextResponse.json({
        success: false,
        error: 'FB not configured',
      })
    }

    // 1. Update audience hashes (remove old, add new) for all configured audiences
    if (old_phone) {
      const oldPhoneHash = hashPhone(old_phone)
      const oldEmailHash = old_email ? hashEmail(old_email) : undefined
      const newPhoneHash = hashPhone(new_phone)
      const newEmailHash = new_email ? hashEmail(new_email) : undefined

      const audienceIds = [
        settings.audienceAllMembers,
        settings.audienceTrialNotEnrolled,
        settings.audienceEventAttendees,
        settings.audienceCurrentStudents,
      ].filter(Boolean)

      for (const audienceId of audienceIds) {
        // Remove old hash
        await removeFromCustomAudience(
          settings.fbAccessToken,
          audienceId,
          oldPhoneHash,
          oldEmailHash
        ).catch(() => {}) // non-blocking

        // Add new hash
        await addToCustomAudience(
          settings.fbAccessToken,
          audienceId,
          newPhoneHash,
          newEmailHash
        ).catch(() => {}) // non-blocking
      }
    }

    // 2. Re-send previous conversion events with new contact info
    const { data: previousLogs } = await supabase
      .from('fb_conversion_logs')
      .select('*')
      .eq('member_id', member_id)
      .eq('is_resend', false)
      .eq('fb_status', 'sent')
      .order('created_at', { ascending: true })

    const logs = (previousLogs || []) as Array<{
      id: string
      event_type: string
      reference_id: string
      branch_id: string | null
      fb_event_name: string
    }>

    let resent = 0
    let failed = 0

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i]

      const params: ConversionParams = {
        event_type: log.event_type as ConversionParams['event_type'],
        phone: new_phone,
        email: new_email || undefined,
        member_id,
        entity_id: log.reference_id || log.id,
        branch_id: log.branch_id || undefined,
        is_resend: true,
        resend_suffix: `resend_${i + 1}`,
        original_log_id: log.id,
      }

      const result = await sendFBConversionInternal(params)

      if (result.success) {
        resent++
      } else {
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      resent,
      failed,
      total: logs.length,
    })
  } catch (error) {
    console.error('[FB] resend error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to resend events' },
      { status: 500 }
    )
  }
}
