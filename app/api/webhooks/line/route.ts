// app/api/webhooks/line/route.ts

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { processInboundMessage, getChannelByPlatform } from '@/lib/services/chat-webhook'

export const dynamic = 'force-dynamic';

// LINE Webhook endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Empty body = verification request
    if (!body || body === '{}') {
      return NextResponse.json({ success: true });
    }

    let webhookBody;
    try {
      webhookBody = JSON.parse(body);
    } catch {
      return NextResponse.json({ success: true });
    }

    if (!webhookBody.events || webhookBody.events.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Get LINE channel from chat_channels table
    const channel = await getChannelByPlatform('line');
    if (!channel) {
      console.error('No active LINE chat channel configured');
      return NextResponse.json({ success: true });
    }

    const channelSecret = channel.credentials.channelSecret;

    // Validate signature if secret is configured
    if (channelSecret) {
      const signature = request.headers.get('x-line-signature') || '';
      const hash = crypto
        .createHmac('sha256', channelSecret)
        .update(body)
        .digest('base64');

      if (hash !== signature) {
        console.error('LINE webhook: invalid signature');
        return NextResponse.json({ success: true });
      }
    }

    // Process events
    const accessToken = channel.credentials.accessToken;

    for (const event of webhookBody.events) {
      if (event.type !== 'message') continue;

      const userId = event.source?.userId;
      if (!userId) continue;

      // Get user profile from LINE
      let displayName: string | undefined;
      let avatarUrl: string | undefined;
      if (accessToken) {
        try {
          const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (profileRes.ok) {
            const profile = await profileRes.json();
            displayName = profile.displayName;
            avatarUrl = profile.pictureUrl;
          }
        } catch {}
      }

      // Map LINE message type
      const msg = event.message;
      let messageType = 'text';
      let content: string | undefined;
      let mediaUrl: string | undefined;
      const metadata: Record<string, any> = {};

      switch (msg.type) {
        case 'text':
          messageType = 'text';
          content = msg.text;
          break;
        case 'image':
          messageType = 'image';
          // Image content URL requires LINE API to download
          mediaUrl = `https://api-data.line.me/v2/bot/message/${msg.id}/content`;
          break;
        case 'sticker':
          messageType = 'sticker';
          metadata.stickerId = msg.stickerId;
          metadata.packageId = msg.packageId;
          content = `[สติกเกอร์]`;
          break;
        case 'audio':
          messageType = 'audio';
          mediaUrl = `https://api-data.line.me/v2/bot/message/${msg.id}/content`;
          break;
        case 'video':
          messageType = 'video';
          mediaUrl = `https://api-data.line.me/v2/bot/message/${msg.id}/content`;
          break;
        case 'location':
          messageType = 'location';
          content = msg.title || msg.address || 'ตำแหน่ง';
          metadata.latitude = msg.latitude;
          metadata.longitude = msg.longitude;
          metadata.address = msg.address;
          break;
        case 'file':
          messageType = 'file';
          content = msg.fileName;
          mediaUrl = `https://api-data.line.me/v2/bot/message/${msg.id}/content`;
          metadata.fileName = msg.fileName;
          metadata.fileSize = msg.fileSize;
          break;
        default:
          messageType = 'text';
          content = `[${msg.type}]`;
      }

      await processInboundMessage({
        channelId: channel.id,
        platformUserId: userId,
        senderName: displayName,
        senderAvatar: avatarUrl,
        messageType,
        content,
        mediaUrl,
        platformMessageId: msg.id,
        metadata,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('LINE webhook error:', error);
    return NextResponse.json({ success: true });
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'LINE webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
