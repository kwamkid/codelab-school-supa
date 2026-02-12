import { NextRequest, NextResponse } from 'next/server'
import { sendFBConversionInternal } from '@/lib/fb/handler'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุเบอร์โทรสำหรับทดสอบ' },
        { status: 400 }
      )
    }

    const result = await sendFBConversionInternal({
      event_type: 'register',
      phone,
      entity_id: `test_${Date.now()}`,
    })

    console.log('[FB] test-event result:', JSON.stringify({
      success: result.success,
      logId: result.logId,
      error: result.error,
      capiSuccess: result.capiResult?.success,
      capiError: result.capiResult?.error,
    }))

    return NextResponse.json({
      success: result.success,
      logId: result.logId,
      error: result.error,
      capiResult: result.capiResult,
    })
  } catch (error) {
    console.error('[FB] test-event error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send test event' },
      { status: 500 }
    )
  }
}
