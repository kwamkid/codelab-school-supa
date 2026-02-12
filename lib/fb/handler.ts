import { createServiceClient } from '@/lib/supabase/server'
import { getFacebookAdsSettings, FacebookAdsSettings } from '@/lib/supabase/services/facebook-ads-settings'
import { hashPhone, hashEmail, sha256, mapEventToFBEvent, generateEventId } from './utils'
import {
  sendConversionEvent,
  addToCustomAudience,
  removeFromCustomAudience,
  FBApiResult,
} from './api'

export interface ConversionParams {
  event_type: 'register' | 'trial' | 'event_join' | 'purchase'
  phone?: string
  email?: string
  member_id?: string // parent_id — used for phone lookup if phone is empty
  entity_id: string // ID of the created record (booking_id, registration_id, etc.)
  branch_id?: string
  custom_data?: Record<string, unknown>
  is_resend?: boolean
  resend_suffix?: string // e.g. 'resend_1'
  original_log_id?: string
}

interface ConversionResult {
  success: boolean
  logId?: string
  capiResult?: FBApiResult
  audienceResults?: Array<{ action: string; audienceId: string; result: FBApiResult }>
  error?: string
}

/**
 * Core handler: send FB conversion event + audience sync + log.
 * Used by both API route and internal server-side calls.
 */
export async function sendFBConversionInternal(
  params: ConversionParams
): Promise<ConversionResult> {
  console.log('[FB CAPI] handler called:', params.event_type, 'entity:', params.entity_id)

  const supabase = createServiceClient()

  let settings: FacebookAdsSettings
  try {
    settings = await getFacebookAdsSettings()
    console.log('[FB CAPI] settings loaded, pixelId:', settings.fbPixelId ? 'set' : 'empty', 'token:', settings.fbAccessToken ? 'set' : 'empty')
  } catch (settingsErr) {
    console.error('[FB CAPI] Failed to load settings:', settingsErr)
    return { success: false, error: 'Failed to load FB settings' }
  }

  // Check if CAPI is configured
  if (!settings.fbPixelId || !settings.fbAccessToken) {
    console.log('[FB CAPI] Not configured, skipping')
    return { success: false, error: 'FB Pixel ID or Access Token not configured' }
  }

  // Resolve phone from member_id if not provided
  let phone = params.phone
  let email = params.email

  if (!phone && params.member_id) {
    const { data: parent } = await supabase
      .from('parents')
      .select('phone, email')
      .eq('id', params.member_id)
      .single()

    if (parent) {
      phone = (parent as { phone: string; email: string | null }).phone
      if (!email) {
        email = (parent as { phone: string; email: string | null }).email || undefined
      }
    }
  }

  if (!phone) {
    return { success: false, error: 'No phone number available' }
  }

  // Hash user data
  const phonehash = hashPhone(phone)
  const emailhash = email ? hashEmail(email) : undefined

  // Build event
  const fbEventName = mapEventToFBEvent(params.event_type)
  const eventId = generateEventId(
    params.event_type,
    params.entity_id,
    params.resend_suffix
  )

  // 1. Send CAPI event
  const capiResult = await sendConversionEvent(
    settings.fbPixelId,
    settings.fbAccessToken,
    {
      eventName: fbEventName,
      eventTime: Math.floor(Date.now() / 1000),
      eventId,
      userData: {
        ph: [phonehash],
        em: emailhash ? [emailhash] : undefined,
        country: [sha256('th')],
      },
      customData: params.custom_data
        ? {
            value: (params.custom_data.value as number) || 0,
            currency: 'THB',
            content_name: (params.custom_data.content_name as string) || undefined,
            content_category: 'education',
          }
        : { value: 0, currency: 'THB', content_category: 'education' },
    },
    settings.fbTestEventCode || undefined
  )

  console.log('[FB CAPI] CAPI result:', capiResult.success ? 'sent' : 'failed', capiResult.error || '')

  // 2. Audience sync
  const audienceResults: Array<{
    action: string
    audienceId: string
    result: FBApiResult
  }> = []

  const audienceActions = getAudienceActions(params.event_type, settings)

  for (const action of audienceActions) {
    if (!action.audienceId) continue // skip if audience ID not configured

    let result: FBApiResult
    if (action.type === 'add') {
      result = await addToCustomAudience(
        settings.fbAccessToken,
        action.audienceId,
        phonehash,
        emailhash
      )
    } else {
      result = await removeFromCustomAudience(
        settings.fbAccessToken,
        action.audienceId,
        phonehash,
        emailhash
      )
    }

    audienceResults.push({
      action: `${action.type}:${action.name}`,
      audienceId: action.audienceId,
      result,
    })
  }

  const audienceOverallStatus = audienceResults.length === 0
    ? 'skipped'
    : audienceResults.every((r) => r.result.success)
      ? 'sent'
      : audienceResults.some((r) => r.result.success)
        ? 'partial'
        : 'failed'

  // 3. Log to database
  const logEntry = {
    event_type: params.event_type,
    fb_event_name: fbEventName,
    event_id: eventId,
    member_id: params.member_id || null,
    reference_id: params.entity_id,
    phone_hash: phonehash,
    email_hash: emailhash || null,
    payload: {
      eventName: fbEventName,
      eventId,
      phone: phone.slice(0, 3) + '***' + phone.slice(-2), // partial for debug
      hasEmail: !!email,
      customData: params.custom_data || null,
    },
    fb_response: capiResult.response || null,
    fb_status: capiResult.success ? 'sent' : 'failed',
    audience_actions: audienceResults.length > 0 ? audienceResults : null,
    audience_status: audienceOverallStatus,
    is_resend: params.is_resend || false,
    original_log_id: params.original_log_id || null,
    branch_id: params.branch_id || null,
  }

  const { data: logData, error: logError } = await supabase
    .from('fb_conversion_logs')
    .insert(logEntry as Record<string, unknown>)
    .select('id')
    .single()

  if (logError) {
    console.error('[FB CAPI] Error logging conversion:', logError)
  }

  return {
    success: capiResult.success,
    logId: (logData as { id: string } | null)?.id,
    capiResult,
    audienceResults,
  }
}

/**
 * Determine which audience actions to perform for a given event type.
 */
function getAudienceActions(
  eventType: string,
  settings: FacebookAdsSettings
): Array<{
  type: 'add' | 'remove'
  name: string
  audienceId: string
}> {
  const actions: Array<{
    type: 'add' | 'remove'
    name: string
    audienceId: string
  }> = []

  switch (eventType) {
    case 'register':
      if (settings.audienceAllMembers) {
        actions.push({
          type: 'add',
          name: 'all_members',
          audienceId: settings.audienceAllMembers,
        })
      }
      break

    case 'trial':
      if (settings.audienceAllMembers) {
        actions.push({
          type: 'add',
          name: 'all_members',
          audienceId: settings.audienceAllMembers,
        })
      }
      if (settings.audienceTrialNotEnrolled) {
        actions.push({
          type: 'add',
          name: 'trial_not_enrolled',
          audienceId: settings.audienceTrialNotEnrolled,
        })
      }
      break

    case 'event_join':
      if (settings.audienceAllMembers) {
        actions.push({
          type: 'add',
          name: 'all_members',
          audienceId: settings.audienceAllMembers,
        })
      }
      if (settings.audienceEventAttendees) {
        actions.push({
          type: 'add',
          name: 'event_attendees',
          audienceId: settings.audienceEventAttendees,
        })
      }
      break

    case 'purchase':
      if (settings.audienceAllMembers) {
        actions.push({
          type: 'add',
          name: 'all_members',
          audienceId: settings.audienceAllMembers,
        })
      }
      if (settings.audienceCurrentStudents) {
        actions.push({
          type: 'add',
          name: 'current_students',
          audienceId: settings.audienceCurrentStudents,
        })
      }
      if (settings.audienceTrialNotEnrolled) {
        actions.push({
          type: 'remove',
          name: 'trial_not_enrolled',
          audienceId: settings.audienceTrialNotEnrolled,
        })
      }
      break
  }

  return actions
}
