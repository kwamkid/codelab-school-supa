// app/api/webhooks/line/route.ts

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getLineSettings } from '@/lib/supabase/services/line-settings'

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Simple in-memory storage for webhook logs (for development)
const webhookLogs: any[] = [];
const MAX_LOGS = 20;

// LINE Webhook endpoint
export async function POST(request: NextRequest) {
  console.log('=== Webhook POST received ===');
  
  try {
    // Get request body as text for signature validation
    const body = await request.text();
    console.log('Webhook body length:', body.length);
    
    // สำหรับ webhook verification จาก LINE
    // LINE จะส่ง request มาโดยไม่มี events
    if (!body || body === '{}') {
      console.log('Empty body - verification request');
      return NextResponse.json({ success: true });
    }
    
    // Parse body
    let webhookBody;
    try {
      webhookBody = JSON.parse(body);
    } catch (e) {
      console.error('Failed to parse body:', e);
      return NextResponse.json({ success: true });
    }
    
    // ถ้าไม่มี events ให้ return 200 OK
    if (!webhookBody.events || webhookBody.events.length === 0) {
      console.log('No events in webhook body');
      return NextResponse.json({ success: true });
    }
    
    // Get LINE settings
    let settings;
    try {
      settings = await getLineSettings();
      console.log('Got LINE settings, has secret:', !!settings.messagingChannelSecret);
    } catch (error) {
      console.error('Failed to get LINE settings:', error);
      // Return 200 to prevent LINE from retrying
      return NextResponse.json({ success: true });
    }
    
    // Skip signature validation if no secret configured
    if (!settings.messagingChannelSecret) {
      console.log('No channel secret configured, skipping signature validation');
    } else {
      // Validate signature
      const signature = request.headers.get('x-line-signature') || '';
      console.log('Signature present:', !!signature);
      
      try {
        const hash = crypto
          .createHmac('sha256', settings.messagingChannelSecret)
          .update(body)
          .digest('base64');
        
        if (hash !== signature) {
          console.error('Invalid signature');
          console.log('Expected:', hash);
          console.log('Received:', signature);
          // Return 200 anyway to prevent retries
          return NextResponse.json({ success: true });
        }
        console.log('Signature valid');
      } catch (error) {
        console.error('Signature validation error:', error);
        // Return 200 anyway
        return NextResponse.json({ success: true });
      }
    }
    
    // Process events
    console.log('Processing', webhookBody.events.length, 'events');
    
    // Store logs
    if (webhookBody.events && webhookBody.events.length > 0) {
      for (const event of webhookBody.events) {
        const log = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          type: event.type,
          userId: event.source?.userId || 'unknown',
          message: event.message?.text || '',
          data: event
        };
        
        webhookLogs.unshift(log);
        if (webhookLogs.length > MAX_LOGS) {
          webhookLogs.pop();
        }
      }
    }
    
    // Always return 200 OK
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    // Always return 200 to prevent LINE from retrying
    return NextResponse.json({ success: true });
  }
}

// GET request for webhook verification and logs
export async function GET(request: NextRequest) {
  try {
    // Return webhook logs
    return NextResponse.json({
      status: 'ok',
      message: 'LINE webhook endpoint is active',
      timestamp: new Date().toISOString(),
      logs: webhookLogs,
      count: webhookLogs.length
    });
    
  } catch (error) {
    console.error('Webhook GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}