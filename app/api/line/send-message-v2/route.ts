// app/api/line/send-message-v2/route.ts

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log('=== Send Message V2 API called ===');
  
  try {
    const body = await request.json();
    const { userId, message, accessToken } = body;
    
    console.log('Request:', { 
      userId, 
      messageLength: message?.length,
      hasToken: !!accessToken 
    });
    
    if (!userId || !message || !accessToken) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields'
      }, { status: 400 });
    }
    
    // Send message using LINE Messaging API
    console.log('Sending to LINE API...');
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: userId,
        messages: [{
          type: 'text',
          text: message
        }]
      })
    });
    
    console.log('LINE API Response status:', response.status);
    
    if (response.ok) {
      console.log('Message sent successfully');
      return NextResponse.json({
        success: true,
        message: 'ส่งข้อความสำเร็จ'
      });
    }
    
    // Handle errors
    const errorText = await response.text();
    console.error('LINE API error response:', errorText);
    
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }
    
    let errorMessage = 'ไม่สามารถส่งข้อความได้';
    
    if (response.status === 400) {
      if (errorData.message?.includes('Invalid user')) {
        errorMessage = 'User ID ไม่ถูกต้อง หรือผู้ใช้ยังไม่ได้เพิ่มเพื่อน';
      } else {
        errorMessage = `ข้อมูลไม่ถูกต้อง: ${errorData.message || 'Unknown error'}`;
      }
    } else if (response.status === 401) {
      errorMessage = 'Channel Access Token ไม่ถูกต้อง';
    } else if (response.status === 429) {
      errorMessage = 'ส่งข้อความเกินโควต้าที่กำหนด';
    }
    
    console.error('Error message:', errorMessage);
    
    return NextResponse.json({
      success: false,
      message: errorMessage,
      details: errorData
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการส่งข้อความ',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}