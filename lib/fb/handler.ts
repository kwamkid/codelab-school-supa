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
  // Click ids from the browser (online booking form)
  fbc?: string
  fbp?: string
  client_user_agent?: string
  // Chat contact the event came from (booking/enrollment made inside the chat).
  // Links that contact to the parent + phone, and is preferred for Messenger matching.
  chat_contact_id?: string
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

  // Resolve phone/email/name from the parent (member_id, else by phone)
  let phone = params.phone
  let email = params.email
  let parentRow: { id: string; phone: string | null; email: string | null; display_name: string | null } | null = null

  if (params.member_id) {
    const { data } = await (supabase as any)
      .from('parents')
      .select('id, phone, email, display_name')
      .eq('id', params.member_id)
      .maybeSingle()
    parentRow = data || null
  }
  if (!parentRow && phone) {
    const { data } = await (supabase as any)
      .from('parents')
      .select('id, phone, email, display_name')
      .eq('phone', phone.replace(/\D/g, ''))
      .limit(1)
      .maybeSingle()
    parentRow = data || null
  }
  if (parentRow) {
    if (!phone) phone = parentRow.phone || undefined
    if (!email) email = parentRow.email || undefined
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

  if (params.chat_contact_id) await linkChatContact(supabase, params.chat_contact_id, phone, parentRow?.id)

  // Extra match keys: name, external id, click ids, Messenger/IG chat id
  const match = await resolveMatchKeys(supabase, phone, parentRow, params)

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
        ...match.userData,
      },
      actionSource: match.actionSource,
      messagingChannel: match.messagingChannel,
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
      match: match.summary,
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
    .insert(logEntry as any)
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
      // สมัครสมาชิก → สนใจแต่ยังไม่สมัครเรียน
      if (settings.audienceTrialNotEnrolled) {
        actions.push({
          type: 'add',
          name: 'trial_not_enrolled',
          audienceId: settings.audienceTrialNotEnrolled,
        })
      }
      break

    case 'trial':
      // ทดลองเรียน → สนใจแต่ยังไม่สมัครเรียน
      if (settings.audienceTrialNotEnrolled) {
        actions.push({
          type: 'add',
          name: 'trial_not_enrolled',
          audienceId: settings.audienceTrialNotEnrolled,
        })
      }
      break

    case 'event_join':
      // เข้าร่วม Event → เข้าร่วม Event + สนใจแต่ยังไม่สมัครเรียน
      if (settings.audienceEventAttendees) {
        actions.push({
          type: 'add',
          name: 'event_attendees',
          audienceId: settings.audienceEventAttendees,
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

/**
 * Look up the identifiers that let Meta tie this event back to an ad:
 * - fn/ln/external_id from the parent row
 * - fbc/fbp captured on the online trial booking form (same phone)
 * - the Messenger/IG chat (PSID) of this parent → Conversions API for Business
 *   Messaging, which is how click-to-Messenger ads get purchase attribution.
 */
export async function resolveMatchKeys(
  supabase: any,
  phone: string,
  parent: { id: string; display_name: string | null } | null,
  params: ConversionParams
): Promise<{
  userData: Record<string, unknown>
  actionSource?: 'business_messaging'
  messagingChannel?: 'messenger' | 'instagram'
  summary: Record<string, unknown>
}> {
  const userData: Record<string, unknown> = {}
  const summary: Record<string, unknown> = {}
  const digits = phone.replace(/\D/g, '')

  try {
    if (parent) {
      userData.external_id = [sha256(parent.id)]
      const parts = (parent.display_name || '').trim().split(/\s+/).filter(Boolean)
      if (parts.length) userData.fn = [sha256(parts[0])]
      if (parts.length > 1) userData.ln = [sha256(parts[parts.length - 1])]
      summary.parent = true
    }

    // Click ids: passed in directly, else the latest online booking with this phone
    let fbc = params.fbc
    let fbp = params.fbp
    let ua = params.client_user_agent
    if (!fbc && !fbp && digits) {
      const { data: tb } = await supabase
        .from('trial_bookings')
        .select('fbc, fbp, client_user_agent')
        .eq('parent_phone', digits)
        .or('fbc.not.is.null,fbp.not.is.null')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (tb) { fbc = tb.fbc || undefined; fbp = tb.fbp || undefined; ua = ua || tb.client_user_agent || undefined }
    }
    if (fbc) userData.fbc = fbc
    if (fbp) userData.fbp = fbp
    if (ua) userData.client_user_agent = ua
    summary.fbc = !!fbc
    summary.fbp = !!fbp

    // Messenger / Instagram chat of this parent (linked, or same phone typed in chat)
    const ors = [
      params.chat_contact_id ? `id.eq.${params.chat_contact_id}` : null,
      parent ? `parent_id.eq.${parent.id}` : null, digits.length >= 9 ? `phone.eq.${digits}` : null]
      .filter(Boolean).join(',')
    if (ors) {
      const { data: contacts } = await supabase
        .from('chat_contacts')
        .select('id, platform_user_id, chat_channels!inner(type, platform_id, credentials), ad_referrals(ad_id, campaign_name, last_referred_at)')
        .in('chat_channels.type', ['facebook', 'instagram'])
        .or(ors)
        .limit(10)
      const list = (contacts || []) as any[]
      // Prefer the chat it was made from, then the one that came from an ad most recently
      list.sort((a, b) =>
        Number(b.id === params.chat_contact_id) - Number(a.id === params.chat_contact_id) || lastRef(b) - lastRef(a))
      const c = list[0]
      if (c) {
        const ch = c.chat_channels
        const pageId = ch.credentials?.pageId || ch.platform_id
        if (ch.type === 'facebook' && pageId) {
          userData.page_id = pageId
          userData.page_scoped_user_id = c.platform_user_id
          summary.messaging = 'messenger'
        } else if (ch.type === 'instagram' && ch.platform_id) {
          userData.ig_account_id = ch.platform_id
          userData.ig_sid = c.platform_user_id
          summary.messaging = 'instagram'
        }
        const refs = (c.ad_referrals || []) as any[]
        if (refs.length) {
          const latest = refs.sort((a, b) => +new Date(b.last_referred_at) - +new Date(a.last_referred_at))[0]
          summary.adId = latest.ad_id
          summary.campaign = latest.campaign_name || undefined
        }
        if (summary.messaging) {
          return {
            userData,
            actionSource: 'business_messaging',
            messagingChannel: summary.messaging as 'messenger' | 'instagram',
            summary,
          }
        }
      }
    }
  } catch (err) {
    console.error('[FB CAPI] resolveMatchKeys failed:', err)
  }
  return { userData, summary }
}

function lastRef(c: any): number {
  const refs = (c?.ad_referrals || []) as any[]
  return refs.reduce((m, r) => Math.max(m, +new Date(r.last_referred_at) || 0), 0)
}

/** Remember phone + parent on the chat contact the booking/enrollment was made from. */
async function linkChatContact(supabase: any, contactId: string, phone: string, parentId?: string) {
  try {
    const { data: c } = await supabase
      .from('chat_contacts')
      .select('phone, parent_id')
      .eq('id', contactId)
      .maybeSingle()
    if (!c) return
    const patch: Record<string, unknown> = {}
    const digits = phone.replace(/\D/g, '')
    if (!c.phone && digits) patch.phone = digits
    if (!c.parent_id && parentId) patch.parent_id = parentId
    if (Object.keys(patch).length) await supabase.from('chat_contacts').update(patch).eq('id', contactId)
  } catch (err) {
    console.error('[FB CAPI] linkChatContact failed:', err)
  }
}
