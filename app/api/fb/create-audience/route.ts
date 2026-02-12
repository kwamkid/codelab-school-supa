import { NextRequest, NextResponse } from 'next/server'
import { getFacebookAdsSettings } from '@/lib/supabase/services/facebook-ads-settings'
import { createCustomAudience } from '@/lib/fb/api'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุชื่อ Audience' },
        { status: 400 }
      )
    }

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

    const result = await createCustomAudience(
      settings.fbAccessToken,
      settings.adAccountId,
      name.trim(),
      (description || '').trim()
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      audienceId: result.audienceId,
    })
  } catch (error) {
    console.error('[FB] create-audience error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create audience' },
      { status: 500 }
    )
  }
}
