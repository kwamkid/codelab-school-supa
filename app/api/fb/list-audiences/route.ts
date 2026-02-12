import { NextResponse } from 'next/server'
import { getFacebookAdsSettings } from '@/lib/supabase/services/facebook-ads-settings'
import { listCustomAudiences } from '@/lib/fb/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const settings = await getFacebookAdsSettings()

    if (!settings.fbAccessToken) {
      return NextResponse.json(
        { success: false, error: 'Access Token ยังไม่ได้ตั้งค่า' },
        { status: 400 }
      )
    }

    if (!settings.adAccountId) {
      return NextResponse.json(
        { success: false, error: 'Ad Account ID ยังไม่ได้ตั้งค่า' },
        { status: 400 }
      )
    }

    const result = await listCustomAudiences(settings.fbAccessToken, settings.adAccountId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      audiences: result.audiences,
    })
  } catch (error) {
    console.error('[FB] list-audiences error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list audiences' },
      { status: 500 }
    )
  }
}
