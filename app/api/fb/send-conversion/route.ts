import { NextRequest, NextResponse } from 'next/server'
import { sendFBConversionInternal, ConversionParams } from '@/lib/fb/handler'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const params: ConversionParams = {
      event_type: body.event_type,
      phone: body.phone,
      email: body.email,
      member_id: body.member_id,
      entity_id: body.entity_id,
      branch_id: body.branch_id,
      custom_data: body.custom_data,
      is_resend: body.is_resend || false,
      resend_suffix: body.resend_suffix,
      original_log_id: body.original_log_id,
    }

    if (!params.event_type || !params.entity_id) {
      return NextResponse.json(
        { success: false, error: 'Missing event_type or entity_id' },
        { status: 400 }
      )
    }

    if (!params.phone && !params.member_id) {
      return NextResponse.json(
        { success: false, error: 'Missing phone or member_id' },
        { status: 400 }
      )
    }

    const result = await sendFBConversionInternal(params)

    return NextResponse.json({
      success: result.success,
      logId: result.logId,
      error: result.error,
    })
  } catch (error) {
    console.error('[FB CAPI] send-conversion error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
