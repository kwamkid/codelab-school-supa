// lib/services/facebook-ads-settings.ts
// Client-side Facebook Ads settings service (uses getClient())

import { getClient } from '@/lib/supabase/client'

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
  updatedAt?: Date
  updatedBy?: string
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
 * Get Facebook Ads settings from client-side.
 */
export async function getFacebookAdsSettings(): Promise<FacebookAdsSettings> {
  try {
    const supabase = getClient()
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('key', SETTINGS_KEY)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return getDefaultFacebookAdsSettings()
      throw error
    }

    if (data && data.value) {
      const val = data.value as Record<string, unknown>
      return {
        fbPixelId: (val.fbPixelId as string) || '',
        fbAccessToken: (val.fbAccessToken as string) || '',
        fbTestEventCode: (val.fbTestEventCode as string) || '',
        audienceAllMembers: (val.audienceAllMembers as string) || '',
        audienceTrialNotEnrolled: (val.audienceTrialNotEnrolled as string) || '',
        audienceEventAttendees: (val.audienceEventAttendees as string) || '',
        audienceCurrentStudents: (val.audienceCurrentStudents as string) || '',
        updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
        updatedBy: data.updated_by || undefined,
      }
    }

    return getDefaultFacebookAdsSettings()
  } catch (error) {
    console.error('Error getting Facebook Ads settings:', error)
    return getDefaultFacebookAdsSettings()
  }
}

/**
 * Update Facebook Ads settings from client-side.
 */
export async function updateFacebookAdsSettings(
  settings: Partial<FacebookAdsSettings>,
  userId: string
): Promise<void> {
  try {
    const supabase = getClient()

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { updatedAt, updatedBy, ...settingsData } = settings

    const { error } = await supabase.from('settings').upsert(
      {
        key: SETTINGS_KEY,
        value: settingsData,
        description: 'Facebook Ads Integration (CAPI + Custom Audiences)',
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )

    if (error) throw error
  } catch (error) {
    console.error('Error updating Facebook Ads settings:', error)
    throw error
  }
}

/**
 * Validate settings fields.
 */
export function validateFacebookAdsSettings(
  settings: Partial<FacebookAdsSettings>
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  if (settings.fbAccessToken && !settings.fbPixelId) {
    errors.fbPixelId = 'กรุณาระบุ Pixel ID เมื่อมี Access Token'
  }

  if (settings.fbPixelId && !settings.fbAccessToken) {
    errors.fbAccessToken = 'กรุณาระบุ Access Token เมื่อมี Pixel ID'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
