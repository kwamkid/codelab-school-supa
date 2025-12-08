// lib/services/line-api.ts

import { Client } from '@line/bot-sdk';
import { getLineSettings } from './line-settings';

// Test LINE Messaging API connection
export async function testMessagingAPI(
  channelAccessToken: string
): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  try {
    // Create LINE client
    const client = new Client({
      channelAccessToken: channelAccessToken
    });
    
    // Test by getting bot info
    const botInfo = await client.getBotInfo();
    
    return {
      success: true,
      message: `เชื่อมต่อสำเร็จ! Bot: ${botInfo.displayName}`,
      data: botInfo
    };
  } catch (error: any) {
    console.error('LINE API test error:', error);
    
    // Parse error message
    let message = 'ไม่สามารถเชื่อมต่อได้';
    
    if (error.statusCode === 401) {
      message = 'Channel Access Token ไม่ถูกต้อง';
    } else if (error.statusCode === 400) {
      message = 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบ Channel ID และ Secret';
    } else if (error.message) {
      message = error.message;
    }
    
    return {
      success: false,
      message
    };
  }
}

// Test LINE Login
export async function testLineLogin(
  channelId: string,
  channelSecret: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // For LINE Login, we can't directly test without user interaction
    // But we can validate the format
    
    if (!channelId || !channelSecret) {
      return {
        success: false,
        message: 'กรุณากรอก Channel ID และ Channel Secret'
      };
    }
    
    if (!/^\d{10}$/.test(channelId)) {
      return {
        success: false,
        message: 'Channel ID ต้องเป็นตัวเลข 10 หลัก'
      };
    }
    
    if (channelSecret.length !== 32) {
      return {
        success: false,
        message: 'Channel Secret ต้องมี 32 ตัวอักษร'
      };
    }
    
    // ทดสอบเชื่อมต่อกับ LINE API endpoint
    const response = await fetch('https://api.line.me/v2/oauth/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: channelId,
        client_secret: channelSecret
      })
    });
    
    if (response.status === 400) {
      const error = await response.json();
      if (error.error === 'invalid_client') {
        return {
          success: false,
          message: 'Channel ID หรือ Channel Secret ไม่ถูกต้อง'
        };
      }
    }
    
    // ถ้าไม่ error แสดงว่าข้อมูลถูกต้อง
    return {
      success: true,
      message: 'ข้อมูล LINE Login ถูกต้อง'
    };
    
  } catch (error) {
    console.error('LINE Login test error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการทดสอบ'
    };
  }
}

// Get webhook endpoint URL
export function getWebhookUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/webhooks/line`;
  }
  
  // For server-side
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com';
  return `${baseUrl}/api/webhooks/line`;
}

// Send test message
export async function sendTestMessage(
  userId: string,
  message: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const settings = await getLineSettings();
    
    if (!settings.messagingChannelAccessToken) {
      return {
        success: false,
        message: 'ยังไม่ได้ตั้งค่า Channel Access Token'
      };
    }
    
    const client = new Client({
      channelAccessToken: settings.messagingChannelAccessToken
    });
    
    await client.pushMessage(userId, {
      type: 'text',
      text: message
    });
    
    return {
      success: true,
      message: 'ส่งข้อความทดสอบสำเร็จ'
    };
    
  } catch (error: any) {
    console.error('Send message error:', error);
    
    let message = 'ไม่สามารถส่งข้อความได้';
    
    if (error.statusCode === 400) {
      message = 'User ID ไม่ถูกต้อง หรือผู้ใช้ยังไม่ได้เพิ่มเพื่อน';
    }
    
    return {
      success: false,
      message
    };
  }
}

// Set webhook URL in LINE console
export async function setWebhookUrl(
  channelAccessToken: string,
  webhookUrl: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const response = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        endpoint: webhookUrl
      })
    });
    
    if (response.ok) {
      return {
        success: true,
        message: 'ตั้งค่า Webhook URL สำเร็จ'
      };
    } else {
      const error = await response.json();
      return {
        success: false,
        message: error.message || 'ไม่สามารถตั้งค่า Webhook URL ได้'
      };
    }
    
  } catch (error) {
    console.error('Set webhook URL error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการตั้งค่า Webhook URL'
    };
  }
}

// Verify webhook endpoint is accessible
export async function verifyWebhookEndpoint(
  webhookUrl: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'LINE-WebhookVerification'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'ok') {
        return {
          success: true,
          message: 'Webhook endpoint พร้อมใช้งาน'
        };
      }
    }
    
    return {
      success: false,
      message: 'Webhook endpoint ไม่สามารถเข้าถึงได้'
    };
    
  } catch (error) {
    console.error('Verify webhook error:', error);
    return {
      success: false,
      message: 'ไม่สามารถเชื่อมต่อ Webhook endpoint'
    };
  }
}