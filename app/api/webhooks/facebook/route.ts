// app/api/webhooks/facebook/route.ts — Facebook Messenger + Instagram DM webhook
// Both FB and IG use the same Graph API webhook, differentiated by `object` field

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { processInboundMessage, getChannelByPlatform, findOrCreateContact, findOrCreateConversation, insertOutboundMessage } from '@/lib/services/chat-webhook'
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

  if (mode === 'subscribe' && token) {
    // Try env var
    if (envVerifyToken && token === envVerifyToken) {
      console.log('Facebook webhook verified (env)')
      return new NextResponse(challenge, { status: 200 })
    }

    // Try DB-stored token
    try {
      const supabase = createServiceClient()
      const { data: channels } = await (supabase as any)
        .from('chat_channels')
        .select('credentials')
        .in('type', ['facebook', 'instagram'])
        .eq('is_active', true)
        .limit(1)
      const dbToken = channels?.[0]?.credentials?.webhookVerifyToken
      if (dbToken && token === dbToken) {
        console.log('Facebook webhook verified (db)')
        return new NextResponse(challenge, { status: 200 })
      }
    } catch {}
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

    const signature = request.headers.get('x-hub-signature-256') || ''

    // Process entries — each entry has its own page ID
    for (const entry of webhookBody.entry || []) {
      const entryPageId = entry.id // Page ID that received the message

      // Find the channel matching this specific page
      const channel = await getChannelByPlatform(channelType, entryPageId)
        || await getChannelByPlatform(channelType) // fallback to any active channel

      if (!channel) {
        console.error(`No active ${channelType} chat channel for page ${entryPageId}`)
        continue
      }

      // Validate signature
      if (channel.credentials?.appSecret && signature) {
        const expectedSig = 'sha256=' + crypto
          .createHmac('sha256', channel.credentials.appSecret)
          .update(body)
          .digest('hex')

        if (expectedSig !== signature) {
          console.error('Facebook webhook: invalid signature')
          return NextResponse.json({ success: true })
        }
      }

      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id
        if (!senderId) continue

        // Handle echo messages (sent by page — from FB inbox or other systems)
        if (event.message?.is_echo) {
          const recipientId = event.recipient?.id
          if (recipientId) {
            try {
              const contactId = await findOrCreateContact(channel.id, recipientId)
              const conversationId = await findOrCreateConversation(channel.id, contactId)

              const echoMsg = event.message
              let messageType = 'text'
              let content: string | undefined
              let mediaUrl: string | undefined

              if (echoMsg.text) {
                content = echoMsg.text
              } else if (echoMsg.attachments?.length > 0) {
                const att = echoMsg.attachments[0]
                messageType = att.type === 'image' ? 'image'
                  : att.type === 'audio' ? 'audio'
                  : att.type === 'video' ? 'video'
                  : att.type === 'file' ? 'file'
                  : 'text'
                mediaUrl = att.payload?.url
                if (!echoMsg.text && messageType !== 'text') {
                  content = `[${messageType === 'image' ? 'รูปภาพ' : messageType === 'audio' ? 'เสียง' : messageType === 'video' ? 'วิดีโอ' : 'ไฟล์'}]`
                }
              }

              await insertOutboundMessage({
                conversationId,
                senderId: senderId, // page ID
                senderName: channel.platform_name || channel.name || 'Page',
                messageType,
                content,
                mediaUrl,
                platformMessageId: echoMsg.mid,
                status: 'sent',
              })
              console.log(`FB echo message saved: ${echoMsg.mid}`)
            } catch (echoErr) {
              console.error('FB echo message error:', echoErr)
            }
          }
          continue
        }

        // Get sender profile from Graph API
        let displayName: string | undefined
        let avatarUrl: string | undefined
        const pageAccessToken = channel.credentials?.pageAccessToken
        const pageId = channel.credentials?.pageId || channel.platform_id
        if (pageAccessToken) {
          try {
            const fields = channelType === 'instagram'
              ? 'name,profile_pic'
              : 'first_name,last_name,profile_pic'

            // Try multiple API versions
            let profile: any = null
            for (const version of ['v19.0', 'v21.0']) {
              const profileRes = await fetch(
                `https://graph.facebook.com/${version}/${senderId}?fields=${fields}&access_token=${pageAccessToken}`
              )
              if (profileRes.ok) {
                profile = await profileRes.json()
                console.log(`FB profile OK (${version}): ${senderId} →`, profile.first_name || profile.name)
                break
              }
            }

            if (profile) {
              displayName = channelType === 'instagram'
                ? profile.name
                : `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
              avatarUrl = profile.profile_pic
            } else {
              // Fallback: Conversations API to get participant name
              console.warn(`FB profile: direct fetch failed for ${senderId}, trying conversations API (pageId=${pageId})`)
              try {
                const convRes = await fetch(
                  `https://graph.facebook.com/v19.0/${pageId}/conversations?user_id=${senderId}&fields=participants{id,name,profile_pic}&access_token=${pageAccessToken}`
                )
                if (convRes.ok) {
                  const convData = await convRes.json()
                  const participants = convData.data?.[0]?.participants?.data
                  if (participants) {
                    const user = participants.find((p: any) => p.id === senderId)
                    if (user?.name) {
                      displayName = user.name
                      console.log(`FB conversations fallback OK: ${senderId} → ${displayName}`)
                    }
                    if (user?.profile_pic) {
                      avatarUrl = user.profile_pic
                      console.log(`FB conversations avatar OK: ${senderId}`)
                    }
                  }
                }
              } catch {}
            }

            // Note: /{psid}/picture also blocked — profile pics require Advanced Access
          } catch (profileErr) {
            console.error('FB profile fetch error:', profileErr)
          }
        } else {
          console.warn('FB webhook: no pageAccessToken in channel credentials')
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
            senderAvatarUrl: avatarUrl,
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
