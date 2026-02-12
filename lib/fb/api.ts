const FB_GRAPH_API_VERSION = 'v21.0'
const FB_GRAPH_BASE = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}`

export interface FBConversionEventData {
  eventName: string
  eventTime: number // Unix timestamp in seconds
  eventId: string
  userData: {
    ph?: string[] // hashed phone(s)
    em?: string[] // hashed email(s)
    country?: string[]
  }
  customData?: {
    value?: number
    currency?: string
    content_name?: string
    content_category?: string
    [key: string]: unknown
  }
  actionSource?: 'website' | 'system_generated'
}

export interface FBApiResult {
  success: boolean
  response?: Record<string, unknown>
  error?: string
}

/**
 * Send conversion event to Facebook CAPI.
 */
export async function sendConversionEvent(
  pixelId: string,
  accessToken: string,
  eventData: FBConversionEventData,
  testEventCode?: string
): Promise<FBApiResult> {
  try {
    const body: Record<string, unknown> = {
      data: [
        {
          event_name: eventData.eventName,
          event_time: eventData.eventTime,
          event_id: eventData.eventId,
          action_source: eventData.actionSource || 'website',
          user_data: {
            ...eventData.userData,
          },
          custom_data: eventData.customData
            ? {
                ...eventData.customData,
                currency: eventData.customData.currency || 'THB',
                content_category:
                  eventData.customData.content_category || 'education',
              }
            : undefined,
        },
      ],
      access_token: accessToken,
    }

    if (testEventCode) {
      body.test_event_code = testEventCode
    }

    const res = await fetch(`${FB_GRAPH_BASE}/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const json = await res.json()

    if (!res.ok) {
      return {
        success: false,
        response: json,
        error: json?.error?.message || `HTTP ${res.status}`,
      }
    }

    return { success: true, response: json }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Add user to a Facebook Custom Audience.
 */
export async function addToCustomAudience(
  accessToken: string,
  audienceId: string,
  hashedPhone: string,
  hashedEmail?: string
): Promise<FBApiResult> {
  try {
    const schema = hashedEmail ? ['PHONE', 'EMAIL'] : ['PHONE']
    const data = hashedEmail
      ? [[hashedPhone, hashedEmail]]
      : [[hashedPhone]]

    const res = await fetch(`${FB_GRAPH_BASE}/${audienceId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: { schema, data },
        access_token: accessToken,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      return {
        success: false,
        response: json,
        error: json?.error?.message || `HTTP ${res.status}`,
      }
    }
    return { success: true, response: json }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Remove user from a Facebook Custom Audience.
 */
export async function removeFromCustomAudience(
  accessToken: string,
  audienceId: string,
  hashedPhone: string,
  hashedEmail?: string
): Promise<FBApiResult> {
  try {
    const schema = hashedEmail ? ['PHONE', 'EMAIL'] : ['PHONE']
    const data = hashedEmail
      ? [[hashedPhone, hashedEmail]]
      : [[hashedPhone]]

    const res = await fetch(`${FB_GRAPH_BASE}/${audienceId}/users`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: { schema, data },
        access_token: accessToken,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      return {
        success: false,
        response: json,
        error: json?.error?.message || `HTTP ${res.status}`,
      }
    }
    return { success: true, response: json }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Test Facebook connection by sending a test event to the CAPI endpoint.
 * This validates both the Access Token and Pixel ID without needing ads_read permission.
 */
export async function testFBConnection(
  accessToken: string,
  pixelId: string
): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  try {
    // Send a test event to validate token + pixel
    // FB requires at least one valid user_data param (e.g. hashed phone)
    const crypto = await import('crypto')
    const hash = (v: string) => crypto.createHash('sha256').update(v).digest('hex')

    const testPayload = {
      data: [
        {
          event_name: 'PageView',
          event_time: Math.floor(Date.now() / 1000),
          event_id: `test_connection_${Date.now()}`,
          action_source: 'website',
          user_data: {
            ph: [hash('6600000000')],
            country: [hash('th')],
          },
        },
      ],
      access_token: accessToken,
      // Always use test_event_code for connection test so it doesn't affect real data
      test_event_code: `TEST_${Date.now()}`,
    }

    const res = await fetch(`${FB_GRAPH_BASE}/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    })
    const json = await res.json()

    if (!res.ok) {
      const errorMsg = json?.error?.message || `HTTP ${res.status}`
      const errorCode = json?.error?.code ? ` (code: ${json.error.code})` : ''
      console.error('[FB] test-connection FB response:', JSON.stringify(json))
      return {
        success: false,
        message: `${errorMsg}${errorCode}`,
        data: json,
      }
    }

    return {
      success: true,
      message: `เชื่อมต่อสำเร็จ: Pixel ID ${pixelId} พร้อมใช้งาน`,
      data: json,
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * List custom audiences for an ad account.
 */
export async function listCustomAudiences(
  accessToken: string,
  adAccountId: string
): Promise<{ success: boolean; audiences?: Array<{ id: string; name: string; approximate_count: number }>; error?: string }> {
  try {
    const cleanId = adAccountId.replace(/^act_/, '')
    const res = await fetch(
      `${FB_GRAPH_BASE}/act_${cleanId}/customaudiences?fields=id,name,approximate_count_lower_bound,approximate_count_upper_bound&limit=100&access_token=${accessToken}`
    )
    const json = await res.json()

    if (!res.ok || json.error) {
      return {
        success: false,
        error: json?.error?.message || `HTTP ${res.status}`,
      }
    }

    return {
      success: true,
      audiences: (json.data || []).map((a: { id: string; name: string; approximate_count_lower_bound?: number; approximate_count_upper_bound?: number }) => ({
        id: a.id,
        name: a.name,
        approximate_count: a.approximate_count_lower_bound || 0,
      })),
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Create a new custom audience for an ad account.
 */
export async function createCustomAudience(
  accessToken: string,
  adAccountId: string,
  name: string,
  description: string
): Promise<{ success: boolean; audienceId?: string; error?: string }> {
  try {
    const cleanId = adAccountId.replace(/^act_/, '')
    const res = await fetch(`${FB_GRAPH_BASE}/act_${cleanId}/customaudiences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        subtype: 'CUSTOM',
        customer_file_source: 'USER_PROVIDED_ONLY',
        access_token: accessToken,
      }),
    })
    const json = await res.json()

    if (!res.ok || json.error) {
      return {
        success: false,
        error: json?.error?.message || `HTTP ${res.status}`,
      }
    }

    return {
      success: true,
      audienceId: json.id,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
