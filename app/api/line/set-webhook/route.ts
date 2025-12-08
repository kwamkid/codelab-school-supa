// app/api/line/set-webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, webhookUrl } = await request.json();
    
    if (!accessToken || !webhookUrl) {
      return NextResponse.json({
        success: false,
        message: 'ข้อมูลไม่ครบถ้วน'
      });
    }
    
    // Set webhook endpoint in LINE
    const response = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        endpoint: webhookUrl
      })
    });
    
    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'ตั้งค่า Webhook URL สำเร็จ'
      });
    }
    
    // Check error
    if (response.status === 401) {
      return NextResponse.json({
        success: false,
        message: 'Access Token ไม่ถูกต้อง'
      });
    }
    
    const error = await response.text();
    console.error('Set webhook error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'ไม่สามารถตั้งค่า Webhook URL ได้'
    });
    
  } catch (error) {
    console.error('Set webhook error:', error);
    return NextResponse.json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการตั้งค่า'
    }, { status: 500 });
  }
}