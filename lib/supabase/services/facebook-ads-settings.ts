import { createServiceClient } from '../server'

const SETTINGS_KEY = 'facebook_ads'

export interface FacebookAdsSettings {
  fbPixelId: string
  fbAccessToken: string
  fbTestEventCode: string // empty = production mode

  // Custom Audience IDs (empty = skip sync for that audience)
  audienceAllMembers: string
  audienceTrialNotEnrolled: string
  audienceEventAttendees: string
  audienceCurrentStudents: string

  // Metadata
  updated_at?: string
  updated_by?: string
}

export function getDefaultFacebookAdsSettings(): FacebookAdsSettings {
  return {
    fbPixelId: '',
    fbAccessToken: '',
    fbTestEventCode: '',
    audienceAllMembers: '',
    audienceTrialNotEnrolled: '',
    audienceEventAttendees: '',
    audienceCurrentStudents: '',
  }
}

/**
 * Get Facebook Ads settings (server-side, bypasses RLS).
 */
export async function getFacebookAdsSettings(): Promise<FacebookAdsSettings> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return getDefaultFacebookAdsSettings()
    console.error('Error getting Facebook Ads settings:', error)
    return getDefaultFacebookAdsSettings()
  }

  return (data?.value as FacebookAdsSettings) || getDefaultFacebookAdsSettings()
}

/**
 * Update Facebook Ads settings (server-side).
 */
export async function updateFacebookAdsSettings(
  settings: Partial<FacebookAdsSettings>,
  userId: string
): Promise<void> {
  const supabase = createServiceClient()

  const current = await getFacebookAdsSettings()
  const updated = {
    ...current,
    ...settings,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }

  const { error } = await supabase.from('settings').upsert({
    key: SETTINGS_KEY,
    value: updated,
    description: 'Facebook Ads Integration (CAPI + Custom Audiences)',
    updated_at: new Date().toISOString(),
    updated_by: userId,
  })

  if (error) {
    console.error('Error updating Facebook Ads settings:', error)
    throw error
  }
}
