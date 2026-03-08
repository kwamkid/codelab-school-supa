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

      const sourceType = event.source?.type; // 'user' | 'group' | 'room'
      const userId = event.source?.userId;
      const groupId = event.source?.groupId;
      const roomId = event.source?.roomId;

      // For group/room: use groupId as contact, userId as sender
      // For 1-on-1: use userId as both contact and sender
      const isGroup = sourceType === 'group' || sourceType === 'room';
      const contactPlatformId = isGroup ? (groupId || roomId) : userId;
      if (!contactPlatformId) continue;

      // Get profile info
      let displayName: string | undefined;
      let avatarUrl: string | undefined;
      let senderName: string | undefined;
      let senderAvatarUrl: string | undefined;
      let memberCount: number | undefined;

      if (accessToken) {
        try {
          if (sourceType === 'group' && groupId) {
            // Get group summary (name + icon + member count)
            const groupRes = await fetch(
              `https://api.line.me/v2/bot/group/${groupId}/summary`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (groupRes.ok) {
              const gp = await groupRes.json();
              displayName = gp.groupName;
              avatarUrl = gp.pictureUrl;
              memberCount = gp.memberCount;
            }
            // Get individual sender's profile within the group
            if (userId) {
              const memberRes = await fetch(
                `https://api.line.me/v2/bot/group/${groupId}/member/${userId}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              if (memberRes.ok) {
                const mp = await memberRes.json();
                senderName = mp.displayName;
                senderAvatarUrl = mp.pictureUrl;
              }
            }
          } else if (sourceType === 'room' && roomId) {
            displayName = 'ห้องแชท';
            if (userId) {
              const memberRes = await fetch(
                `https://api.line.me/v2/bot/room/${roomId}/member/${userId}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              if (memberRes.ok) {
                const mp = await memberRes.json();
                senderName = mp.displayName;
                senderAvatarUrl = mp.pictureUrl;
              }
            }
          } else if (userId) {
            // 1-on-1 chat
            const profileRes = await fetch(
              `https://api.line.me/v2/bot/profile/${userId}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (profileRes.ok) {
              const profile = await profileRes.json();
              displayName = profile.displayName;
              avatarUrl = profile.pictureUrl;
              senderName = profile.displayName;
            }
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
        platformUserId: contactPlatformId,
        senderName: senderName || displayName,
        senderAvatar: isGroup ? undefined : avatarUrl,
        senderAvatarUrl: isGroup ? senderAvatarUrl : avatarUrl,
        messageType,
        content,
        mediaUrl,
        platformMessageId: msg.id,
        metadata,
        // Group-specific
        isGroup,
        groupId: groupId || roomId,
        groupName: isGroup ? displayName : undefined,
        groupAvatarUrl: isGroup ? avatarUrl : undefined,
        memberCount,
        senderId: isGroup ? userId : undefined,
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
