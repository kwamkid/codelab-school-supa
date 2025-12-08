// app/api/test/line-direct/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()

  try {
    const body = await request.json()
    const { parentId } = body

    if (!parentId) {
      return NextResponse.json({ success: false, message: 'Parent ID is required' }, { status: 400 })
    }

    console.log('=== Direct LINE Test ===')
    console.log('Parent ID:', parentId)

    // Step 1: Get parent directly
    const { data: parentData, error: parentError } = await supabase
      .from('parents')
      .select('id, display_name, phone, line_user_id')
      .eq('id', parentId)
      .single()

    if (parentError || !parentData) {
      return NextResponse.json({
        success: false,
        message: 'Parent not found'
      })
    }

    console.log('Parent data:', {
      displayName: parentData.display_name,
      hasLineUserId: !!parentData.line_user_id,
      phone: parentData.phone
    })

    if (!parentData.line_user_id) {
      return NextResponse.json({
        success: false,
        message: 'Parent does not have LINE ID',
        parentName: parentData.display_name
      })
    }

    // Step 2: Get LINE settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'line')
      .single()

    if (settingsError || !settings) {
      return NextResponse.json({
        success: false,
        message: 'LINE settings not found'
      })
    }

    const lineSettings = settings.value as any
    console.log('LINE settings:', {
      hasToken: !!lineSettings.messagingChannelAccessToken,
      tokenLength: lineSettings.messagingChannelAccessToken?.length || 0
    })

    if (!lineSettings.messagingChannelAccessToken) {
      return NextResponse.json({
        success: false,
        message: 'LINE Channel Access Token not configured'
      })
    }

    // Step 3: Send simple test message
    const testMessage = `ทดสอบการส่งข้อความ\n\nสวัสดีคุณ ${parentData.display_name}\nนี่คือข้อความทดสอบจากระบบ\n\nเวลา: ${new Date().toLocaleString('th-TH')}`

    console.log('Sending message to LINE User:', parentData.line_user_id)

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lineSettings.messagingChannelAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: parentData.line_user_id,
        messages: [
          {
            type: 'text',
            text: testMessage
          }
        ]
      })
    })

    console.log('LINE API Response status:', response.status)

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Test message sent successfully!',
        parentName: parentData.display_name
      })
    }

    // Handle errors
    const errorText = await response.text()
    console.error('LINE API error:', errorText)

    let errorMessage = 'Failed to send message'
    if (response.status === 400) {
      errorMessage = 'Invalid request or user has not added bot as friend'
    } else if (response.status === 401) {
      errorMessage = 'Invalid Channel Access Token'
    }

    return NextResponse.json({
      success: false,
      message: errorMessage,
      status: response.status,
      error: errorText
    })
  } catch (error) {
    console.error('Direct LINE test error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}