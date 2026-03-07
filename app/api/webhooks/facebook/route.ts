// app/api/webhooks/facebook/route.ts — Facebook Messenger + Instagram DM webhook
// Both FB and IG use the same Graph API webhook, differentiated by `object` field

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { processInboundMessage, getChannelByPlatform } from '@/lib/services/chat-webhook'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Webhook verification (GET)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Check against env var first, then DB
  const envVerifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN
  let verifyToken = envVerifyToken

  if (!verifyToken) {
    try {
      const supabase = createServiceClient()
      const { data: channels } = await (supabase as any)
        .from('chat_channels')
        .select('credentials')
        .in('type', ['facebook', 'instagram'])
        .eq('is_active', true)
        .limit(1)
      verifyToken = channels?.[0]?.credentials?.webhookVerifyToken
    } catch {}
  }

  if (mode === 'subscribe' && token && token === verifyToken) {
    console.log('Facebook webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// Receive messages (POST)
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    if (!body) return NextResponse.json({ success: true })

    const webhookBody = JSON.parse(body)
    const objectType = webhookBody.object // 'page' for FB, 'instagram' for IG

    // Determine channel type
    const channelType = objectType === 'instagram' ? 'instagram' : 'facebook'

    // Validate signature
    const signature = request.headers.get('x-hub-signature-256') || ''
    const channel = await getChannelByPlatform(channelType)

    if (channel?.credentials?.appSecret && signature) {
      const expectedSig = 'sha256=' + crypto
        .createHmac('sha256', channel.credentials.appSecret)
        .update(body)
        .digest('hex')

      if (expectedSig !== signature) {
        console.error('Facebook webhook: invalid signature')
        return NextResponse.json({ success: true })
      }
    }

    if (!channel) {
      console.error(`No active ${channelType} chat channel configured`)
      return NextResponse.json({ success: true })
    }

    // Process entries
    for (const entry of webhookBody.entry || []) {
      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id
        if (!senderId) continue

        // Skip echo messages (sent by us)
        if (event.message?.is_echo) continue

        // Get sender profile
        let displayName: string | undefined
        let avatarUrl: string | undefined
        const pageAccessToken = channel.credentials?.pageAccessToken
        if (pageAccessToken) {
          try {
            const url = channelType === 'instagram'
              ? `https://graph.facebook.com/v19.0/${senderId}?fields=name,profile_pic&access_token=${pageAccessToken}`
              : `https://graph.facebook.com/v19.0/${senderId}?fields=first_name,last_name,profile_pic&access_token=${pageAccessToken}`
            const profileRes = await fetch(url)
            if (profileRes.ok) {
              const profile = await profileRes.json()
              displayName = profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
              avatarUrl = profile.profile_pic
            } else {
              const errBody = await profileRes.text()
              console.error(`FB profile fetch failed (${profileRes.status}):`, errBody)
            }
          } catch (profileErr) {
            console.error('FB profile fetch error:', profileErr)
          }
        }

        // Process message
        if (event.message) {
          const msg = event.message

          let messageType = 'text'
          let content: string | undefined
          let mediaUrl: string | undefined
          const metadata: Record<string, any> = {}

          if (msg.text) {
            messageType = 'text'
            content = msg.text
          } else if (msg.attachments && msg.attachments.length > 0) {
            const att = msg.attachments[0]
            switch (att.type) {
              case 'image':
                messageType = 'image'
                mediaUrl = att.payload?.url
                break
              case 'audio':
                messageType = 'audio'
                mediaUrl = att.payload?.url
                break
              case 'video':
                messageType = 'video'
                mediaUrl = att.payload?.url
                break
              case 'file':
                messageType = 'file'
                mediaUrl = att.payload?.url
                break
              case 'location':
                messageType = 'location'
                metadata.latitude = att.payload?.coordinates?.lat
                metadata.longitude = att.payload?.coordinates?.long
                content = 'ตำแหน่ง'
                break
              default:
                messageType = 'text'
                content = `[${att.type}]`
            }

            if (msg.sticker_id) {
              messageType = 'sticker'
              metadata.stickerId = msg.sticker_id
              content = '[สติกเกอร์]'
            }
          }

          await processInboundMessage({
            channelId: channel.id,
            platformUserId: senderId,
            senderName: displayName,
            senderAvatar: avatarUrl,
            messageType,
            content,
            mediaUrl,
            platformMessageId: msg.mid,
            metadata,
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Facebook webhook error:', error)
    return NextResponse.json({ success: true })
  }
}
