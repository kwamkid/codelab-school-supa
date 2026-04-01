// app/api/admin/chat/send/route.ts — Send message to customer via platform API

import { NextRequest, NextResponse } from 'next/server'
import {
  getConversationWithContact,
  insertOutboundMessage,
} from '@/lib/services/chat-webhook'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { conversationId, content, messageType = 'text', mediaUrl, mediaUrls, senderId, senderName, quickReplyItems } = await request.json()

    // mediaUrls = array of image URLs (for batch send)
    if (!conversationId || (!content && !mediaUrl && !mediaUrls?.length)) {
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

          const lineMessages: any[] = []

          // Build messages
          if (mediaUrls?.length > 0) {
            // Batch mode: text blocks first, then images
            const textBlocks = (content || '').split('\n\n').map((b: string) => b.trim()).filter(Boolean)
            for (const block of textBlocks) {
              lineMessages.push({ type: 'text', text: block })
            }
            for (const url of mediaUrls) {
              lineMessages.push({ type: 'image', originalContentUrl: url, previewImageUrl: url })
            }
          } else if (messageType === 'image') {
            lineMessages.push({ type: 'image', originalContentUrl: mediaUrl, previewImageUrl: mediaUrl })
            if (content) lineMessages.push({ type: 'text', text: content })
          } else if (messageType === 'video') {
            lineMessages.push({ type: 'video', originalContentUrl: mediaUrl, previewImageUrl: mediaUrl })
            if (content) lineMessages.push({ type: 'text', text: content })
          } else {
            lineMessages.push({ type: 'text', text: content })
          }

          // Add quick reply to last message
          if (quickReplyItems?.length > 0 && lineMessages.length > 0) {
            lineMessages[lineMessages.length - 1].quickReply = {
              items: quickReplyItems.map((item: any) => ({
                type: 'action',
                action: {
                  type: 'message',
                  label: item.label.substring(0, 20),
                  text: item.text || item.label,
                },
              })),
            }
          }

          // LINE allows max 5 messages per push — split if needed
          for (let i = 0; i < lineMessages.length; i += 5) {
            const batch = lineMessages.slice(i, i + 5)
            const res = await fetch('https://api.line.me/v2/bot/message/push', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                to: platformUserId,
                messages: batch,
              }),
            })

            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              throw new Error(`LINE API error: ${err.message || res.statusText}`)
            }
          }
          break
        }

        case 'facebook':
        case 'instagram': {
          const pageAccessToken = channel.credentials?.pageAccessToken
          if (!pageAccessToken) throw new Error('Page access token not configured')

          const sendFbMessage = async (msg: any) => {
            const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ recipient: { id: platformUserId }, message: msg }),
            })
            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              throw new Error(`FB/IG API error: ${JSON.stringify(err.error || err)}`)
            }
            return res.json()
          }

          if (mediaUrls?.length > 0) {
            // Batch: send text blocks then images rapidly (FB groups consecutive images)
            const textBlocks = (content || '').split('\n\n').map((b: string) => b.trim()).filter(Boolean)
            for (const block of textBlocks) {
              await sendFbMessage({ text: block })
            }
            for (const url of mediaUrls) {
              await sendFbMessage({ attachment: { type: 'image', payload: { url, is_reusable: true } } })
            }
          } else {
            let fbMessage: any
            if (messageType === 'image') {
              fbMessage = { attachment: { type: 'image', payload: { url: mediaUrl, is_reusable: true } } }
            } else if (messageType === 'video') {
              fbMessage = { attachment: { type: 'video', payload: { url: mediaUrl, is_reusable: true } } }
            } else {
              fbMessage = { text: content }
            }

            if (quickReplyItems?.length > 0) {
              fbMessage.quick_replies = quickReplyItems.map((item: any) => ({
                content_type: 'text',
                title: item.label.substring(0, 20),
                payload: item.text || item.label,
              }))
            }

            const result = await sendFbMessage(fbMessage)
            platformMessageId = result.message_id
          }
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

    // 3. Store outbound messages in DB (each text block + each image = separate message)
    const sid = senderId || 'admin'
    const sname = senderName || 'Admin'

    if (mediaUrls?.length > 0) {
      // Batch mode: text blocks + images
      const textBlocks = (content || '').split('\n\n').map((b: string) => b.trim()).filter(Boolean)
      for (const block of textBlocks) {
        await insertOutboundMessage({
          conversationId, senderId: sid, senderName: sname,
          messageType: 'text', content: block, status: sendStatus,
        })
      }
      for (const url of mediaUrls) {
        await insertOutboundMessage({
          conversationId, senderId: sid, senderName: sname,
          messageType: 'image', mediaUrl: url, status: sendStatus,
        })
      }
    } else {
      // Single message
      await insertOutboundMessage({
        conversationId, senderId: sid, senderName: sname,
        messageType, content, mediaUrl, platformMessageId, status: sendStatus,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Chat send error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
