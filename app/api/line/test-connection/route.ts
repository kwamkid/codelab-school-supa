// app/api/line/test-connection/route.ts

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, channelId, channelSecret, accessToken } = body;
    
    if (type === 'messaging' && accessToken) {
      // Test Messaging API
      console.log('Testing Messaging API with token:', accessToken.substring(0, 20) + '...');
      
      const response = await fetch('https://api.line.me/v2/bot/info', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      console.log('Messaging API response status:', response.status);
      
      if (response.ok) {
        const botInfo = await response.json();
        console.log('Bot info:', botInfo);
        return NextResponse.json({
          success: true,
          message: `เชื่อมต่อสำเร็จ! Bot: ${botInfo.displayName}`,
          data: botInfo
        });
      } else if (response.status === 401) {
        return NextResponse.json({
          success: false,
          message: 'Channel Access Token ไม่ถูกต้อง'
        });
      } else {
        const errorText = await response.text();
        console.error('Messaging API error:', errorText);
        return NextResponse.json({
          success: false,
          message: 'ไม่สามารถเชื่อมต่อได้'
        });
      }
    }
    
    if (type === 'login' && channelId && channelSecret) {
      // Test LINE Login format
      if (!/^\d{10}$/.test(channelId)) {
        return NextResponse.json({
          success: false,
          message: 'Channel ID ต้องเป็นตัวเลข 10 หลัก'
        });
      }
      
      if (channelSecret.length !== 32) {
        return NextResponse.json({
          success: false,
          message: 'Channel Secret ต้องมี 32 ตัวอักษร'
        });
      }
      
      // For LINE Login, we'll verify format is correct
      // LINE Login doesn't support direct API verification without user flow
      console.log('LINE Login test - Channel ID format valid');
      
      return NextResponse.json({
        success: true,
        message: 'รูปแบบข้อมูล LINE Login ถูกต้อง (กรุณาทดสอบโดยการ Login จริง)'
      });
    }
    
    return NextResponse.json({
      success: false,
      message: 'ข้อมูลไม่ครบถ้วน'
    });
    
  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการทดสอบ'
    }, { status: 500 });
  }
}