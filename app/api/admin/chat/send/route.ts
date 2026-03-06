// app/api/admin/chat/send/route.ts — Send message to customer via platform API

import { NextRequest, NextResponse } from 'next/server'
import {
  getConversationWithContact,
  insertOutboundMessage,
} from '@/lib/services/chat-webhook'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { conversationId, content, messageType = 'text', mediaUrl, senderId, senderName } = await request.json()

    if (!conversationId || (!content && !mediaUrl)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Get conversation + contact + channel
    const data = await getConversationWithContact(conversationId)
    if (!data) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { contact, channel } = data
    const platformUserId = contact.platform_user_id

    // 2. Send via platform API
    let platformMessageId: string | undefined
    let sendStatus: string = 'sent'

    try {
      switch (channel.type) {
        case 'line': {
          const accessToken = channel.credentials?.accessToken
          if (!accessToken) throw new Error('LINE access token not configured')

          const lineMessage: any = messageType === 'text'
            ? { type: 'text', text: content }
            : messageType === 'image'
            ? { type: 'image', originalContentUrl: mediaUrl, previewImageUrl: mediaUrl }
            : { type: 'text', text: content }

          const res = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              to: platformUserId,
              messages: [lineMessage],
            }),
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(`LINE API error: ${err.message || res.statusText}`)
          }
          break
        }

        case 'facebook':
        case 'instagram': {
          const pageAccessToken = channel.credentials?.pageAccessToken
          if (!pageAccessToken) throw new Error('Page access token not configured')

          const fbMessage: any = messageType === 'text'
            ? { text: content }
            : messageType === 'image'
            ? { attachment: { type: 'image', payload: { url: mediaUrl, is_reusable: true } } }
            : { text: content }

          const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: platformUserId },
              message: fbMessage,
            }),
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(`FB/IG API error: ${JSON.stringify(err.error || err)}`)
          }

          const result = await res.json()
          platformMessageId = result.message_id
          break
        }

        default:
          throw new Error(`Unsupported channel type: ${channel.type}`)
      }
    } catch (error: any) {
      console.error('Send message error:', error)
      sendStatus = 'failed'

      // Still record the message as failed
      await insertOutboundMessage({
        conversationId,
        senderId: senderId || 'admin',
        senderName: senderName || 'Admin',
        messageType,
        content,
        mediaUrl,
        platformMessageId,
        status: 'failed',
      })

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 3. Store outbound message
    await insertOutboundMessage({
      conversationId,
      senderId: senderId || 'admin',
      senderName: senderName || 'Admin',
      messageType,
      content,
      mediaUrl,
      platformMessageId,
      status: sendStatus,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Chat send error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
